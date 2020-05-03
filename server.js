function verboseLog (str) {
  if (process.env.VERBOSE_LOG) { console.log(str) }
}

// Set up the PostgreSQL database driver.
import { Pool } from 'pg'
const pg = new Pool({ connectionString: process.env.DATABASE_URL })

import multer from 'multer'
import cookieParser from 'cookie-parser'
import cookieSession from 'cookie-session'
import morgan from 'morgan'

// Set up the Express.js framework for URL routing.
import express from 'express'
const app = express()
app.use(morgan('combined'))

// Set up the nodemailer SMTP driver
import nodemailer from 'nodemailer'

// Set up the Adm-Zip module to handle zip files (MapTiler historical maps come over as zip files)
import AdmZip from 'adm-zip'

// Set up the file system (needed to create/read a temp zip file)
import fs from 'graceful-fs'

// Set up the async.js module to enable coordination of multiple concurrent writes to the database when
// saving all the .png files produced by running MapTiler on a historical map.  Used in insertNewMTMapSection.
import async from 'async'

// Set up session support.
app.use(cookieParser(process.env.COOKIE_SECRET))
app.use(cookieSession({ signed: false }))

// Set up the passport.js module to do Google authentication.
import passport from 'passport'
import passportGoogleOAuth from 'passport-google-oauth'
const GoogleStrategy = passportGoogleOAuth.OAuth2Strategy
app.use(passport.initialize())
passport.serializeUser((user, done) => {
  verboseLog('Serializing user:')
  verboseLog(user)
  done(null /* err */, user.id)
})
passport.deserializeUser((id, done) => {
  verboseLog('Deserializing user: ' + id)
  done(null /* err */, { id: id })
})
if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(
    new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    (token, tokenSecret, profile, done) => {
      let id = 'google!' + profile.id
      // TODO create id in user table
      verboseLog('Authenticated to Google with token: ' + token)
      verboseLog('Secret: ' + tokenSecret)
      verboseLog('Profile:')
      verboseLog(profile)
      done(null /* err */, { id: id })
    }
    ))
}

// TODO: Non-redirecting requireLoginApi for Ajax calls.
function requireLogin (req, res, next) {
  verboseLog('Requiring login. Session is:')
  verboseLog(req.session)
  if (req.session.passport.user) {
    console.log("That's authorized")
    return next()
  }

  console.log("That's not authorized")
  res.redirect('/auth/google')
}

// Set up to handle cross-domain requests
import cors from 'cors'
app.use(cors()) // Enable all cross-domain requests
app.options('*', cors()) // Handle any pre-flight requests for POST or DELETE

// Add headers
app.use((req, res, next) => {
  // Website you wish to allow to connect
  res.set('Access-Control-Allow-Origin', '*')

  // Request methods you wish to allow
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')

  // Pass to next layer of middleware
  next()
})

// TODO: requireLogin everywhere.
app.use(express.static(__dirname + '/' + process.env.STATIC_CLIENT_CONTENT_DIR))

// The user login functions return a status object of the form:
//    { code:      status code
//      uname:    user name
//      upassword:  user password
//      data:      user data, depending on the code returned
//    }
// Status codes are as follows:
//    Code      Meaning
//  "logged_in_std"    User logged in successfully with standard password (not a temp password)
//  "no_user"      No user with that username
//  "bad_pwd"      Bad password for the user attempting to log in
//  "temp_pwd_sent"    Email with a temp password successfully dispatched to user
//  "temp_pwd_unsent"  Could not email user with temp password
//  "logged_in_temp"  User logged in successfully with temp password
//  "duplicate_user"  Cannot create new user with same name as existing one
//  "temp_sent"      Temp password emailed to user
//  "temp_not_sent"   Temp password could not be sent to user
//
// The reason for returning the user name is because the user may have forgotten it and logged in with his email address.  We need
// to let him know the user name AND make sure the HiM client has the correct user name for its subsequent queries to the server.
// Similarly, if the user forgot his password, the server generated a one-time temp password for him.  We need to return the real password because
// the HiM client will use the returned real password and the real user name when it tries to retrieve the user's current scenario.  If we don't
// supply the real (not temp) password, the client will use the temp password and the scenario will not be found.

function authenticatedGoogleUser (username) {
  verboseLog('Checking google user ' + username)
  if (username.indexOf('google!') != 0) { return false }

  if (username == req.session.passport.user) { return true }

  return false
}

// Create a new user or login an existing one
app.get('/user/:username', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    let status = {} // Status object to return to client upon login attempt
    status.data = {} // Data to return to the client upon login attempt
    if (req.query.newuser == 'true') { // This is a new user
      client.query('insert into users (uname, upassword, uemail, udata, ulogin_first, ulogin_last) values ($1, $2, $3, $4, current_timestamp, current_timestamp)',
        [req.params.username, req.query.password, req.query.uemail, req.query.userdata],
        (err, result) => {
          done()
          if (err) {
            resp.statusCode = 409 // status code = "Conflict"
            status.code = 'duplicate_user'
            resp.send(status)
            return console.error(err)
          } else {
            console.log('Logged in new user ' + req.params.username)
            status.code = 'logged_in_std'
            resp.send(status)
          }
        }
      )
    } else { // This is an existing user.  Allow lookup either by user name or email address (in case user forgot the former but remembered the latter).
      client.query('select uname, upassword, upassword_temp, ulogin_count, udata from users where uname = $1 or uemail = $1',
        [req.params.username],
        (err, result) => {
          if (err) {
            done()
            resp.statusCode = 500 // status code = "Error"
            resp.send(err)
            return console.error(err)
          } else if (result.rows.length == 0) {
            // Couldn't find this user
            done()
            resp.statusCode = 404 // status code = "Not found"
            status.code = 'no_user'
            resp.send(status)
          } else {
            // Found the user, so check the password
            if (authenticatedGoogleUser(req.params.username) ||
                            result.rows[0].upassword == req.query.password) {
            // Standard password matches; log in the user
              status.code = 'logged_in_std'
              status.uname = result.rows[0].uname
              status.upassword = result.rows[0].upassword
              status.data = result.rows[0].udata
              resp.send(status)
              // Update last login time; increment # of logins for this user; set temp pwd to "" just in case it was not blank but the
              // user remembered his password and was able to use it.  The temp password should only be good on the next login attempt
              // after the user asked for his password to be sent.
              client.query('update users set (ulogin_last, ulogin_count, upassword_temp) = (current_timestamp, $2, $3) where uname = $1',
                [req.params.username, result.rows[0].ulogin_count + 1, ''],
                (err, result) => { done() }
              )
            } else if ((result.rows[0].upassword_temp) && (result.rows[0].upassword_temp == req.query.password)) {
            // User has a temp password, and that matches what he provided, so log him in
              status.code = 'logged_in_temp'
              status.uname = result.rows[0].uname
              status.upassword = result.rows[0].upassword
              status.data = result.rows[0].udata
              resp.send(status)
              client.query('update users set (ulogin_last, upassword_temp, ulogin_count) = (current_timestamp, $2, $3) where uname = $1',
                [req.params.username, '', result.rows[0].ulogin_count + 1],
                (err, result) => { done() }
              )
            } else {
            // Standard pwd doesn't match, or either we don't have a temp pwd or we do, but that doesn't match either
              done()
              status.code = 'bad_pwd'
              resp.send(status) // Send with HTTP success code of 200; client will sort it out based on status.code
            }
          }
        }
      )
    }
  })
})

// Get the Common Icon Library.  This is the MyIcons element within the distinguished user "HiM" (the system admin, which is like a regular user
// in all other regards).  Get the "HiM" user from the database and return it just like "GET /user/HiM" would.

app.get('/get_CIL/', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    let status = {}
    client.query('select udata from users where uname = $1',
      ['HiM'],
      (err, result) => {
        done()
        if (err) {
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        }
        if (result.rows.length == 0) {
          // Couldn't find this user
          resp.statusCode = 404 // status code = "Not found"
          status.code = 'no_user'
          resp.send(status)
        } else {
          status.code = 'logged_in_std'
          status.uname = 'userName'
          status.upassword = 'password'
          status.data = JSON.stringify({ MyIcons: JSON.parse(result.rows[0].udata).MyIcons })
          resp.send(status)
        }
      })
  })
})

// User forgot his/her password.

app.get('/forgot_password/:username', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('select uname, uemail from users where uname = $1 or uemail = $1',
      [req.params.username],
      (err, result) => {
        if (err) {
          done()
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        } else if (result.rows.length == 0) {
          // Couldn't find this user
          done()
          resp.statusCode = 404 // status code = "Not found"
          status.code = 'no_user'
          resp.send(status)
        } else { // Generate temp password, store in user's record, and email it to him
          let temp = generateTempPassword()
          let uname = result.rows[0].uname
          let uemail = result.rows[0].uemail
          let status = {} // Status object to return to client
          client.query('update users set upassword_temp = $2 where uname = $1',
            [uname, temp],
            (err, result) => {
              if (err) {
                done()
                resp.statusCode = 500 // status code = "Error"
                resp.send(err)
                return console.error(err)
              }
              done()
              let smtpTransport = nodemailer.createTransport('SMTP', {
                service: 'Gmail', // sets automatically host, port and connection security settings
                auth: {
                  user: 'pcashman21him@gmail.com',
                  pass: 'b0eignet1'
                }
              })
              smtpTransport.sendMail({ // email options
                from: 'History in Motion <pcashman21him@gmail.com>', // sender address.  Must be the same as authenticated user if using GMail.
                to: uemail, // receiver
                subject: 'Your temporary password', // subject
                text: "Your one-time temporary password is '" + temp + "'" // body
              }, (error, response) => { // callback
                if (error) {
                  console.log(error)
                  status.code = 'temp_not_sent'
                  resp.send(status)
                } else {
                  console.log('Message sent: ' + response.message)
                  status.code = 'temp_sent'
                  resp.send(status)
                }
                smtpTransport.close() // shut down the connection pool, no more messages.  Comment this line out to continue sending emails.
              })
            }
          )
        }
      })
  })
})

function generateTempPassword () {
  const chars = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789'
  const factor = chars.length
  let temp = ''
  let index
  for (let i = 0; i < 8; i++) {
    index = Math.floor(Math.random() * factor)
    if (index == factor) index--
    temp = temp + chars.charAt(index)
  }
  return temp
}

// Update an existing user

app.get('/update_user/:username', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('update users set (upassword, udata, uemail) = ($2, $3, $4) where uname = $1',
      [req.params.username, req.query.password, req.query.udata, req.query.uemail],
      (err, result) => {
        done()
        if (err) {
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        } else {
          let message = 'Updated user ' + req.params.username
          resp.send(message)
        }
      }
    )
  })
})

// Retrieve the list of scenarios and their version numbers for a user.  User's password must match as well.
app.get('/scenario/:owner', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('select name, version from scenarios,users where owner = $1 and owner = uname and upassword = $2',
      [req.params.owner, req.query.password], (err, result) => {
        done()
        if (err) {
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        }
        console.log('Returning list of scenarios and versions for user ' + req.params.owner)
        resp.send(JSON.stringify(result.rows))
      })
  })
})

// Retrieve one scenario. The scenario owner's name must match his password in the users table.
app.get('/scenario/:owner/:name', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('select data from scenarios, users where owner = $1 and name = $2 and owner = uname and upassword = $3',
      [req.params.owner, req.params.name, req.query.password], (err, result) => {
        done()
        if (err) {
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        }
        if (result.rows.length == 1) {
          console.log("Returning scenario '" + req.params.name + "' for user " + req.params.owner)
          resp.send(result.rows[0].data)
        } else {
          resp.statusCode = 404
          resp.send('Could not find scenario ' + req.params.name)
        }
      })
  })
})

// Retrieve one scenario using its permalink.
app.get('/permalink/:scid', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('select data from scenarios where scid = $1',
      [req.params.scid], (err, result) => {
        done()
        if (err) {
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        } else if (result.rows.length == 0) {
          // Couldn't find this scenario
          done()
          resp.statusCode = 404 // status code = "Not found"
          resp.send('Could not find scenario with permalink ' + req.params.scid)
          return
        }
        console.log('Returning scenario with permalink ' + req.params.scid)
        resp.send(200, result.rows[0].data)
      })
  })
})

// Get a scenario's permalink
app.get('/get_permalink/:owner/:name', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      done()
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    console.log('Permalink requested for user ' + req.params.owner + "'s scenario '" + req.params.name + "'")
    client.query('select scid from scenarios, users where owner = $1 and name = $2 and owner = uname and upassword = $3',
      [req.params.owner, req.params.name, req.query.password], (err, result) => {
        done()
        if (err) {
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        }
        console.log('Returning permalink ' + result.rows[0].scid + " for scenario '" + req.params.name + "' for user " + req.params.owner)
        resp.statusCode = 200
        resp.send({ permalink: result.rows[0].scid })
      })
  })
})

// Helper function to insert a new scenario.  Parameters:
//    client      Postgres client object from a successful opening of the database
//    user      Name of user (owner) for this scenario
//    name      Scenario name
//    nameChanged    Is name the same as the original name of the scenario?
//    data      JSONified scenario to save to database
//    resp      Express object which is the response to be sent back to the client
//    done      Function to call to release Postgres client
//
// For a new scenario, first get the global scenario id from the database.  Update that ID and write it back to the
// database.  Then save the scenario to the database.  Note that the global scenario ID is ONLY in the scenario's
// database record, NOT in the scenario object itself.  This global ID is used as a permalink to the scenario.  For example,
// suppose a user "Thucydides" has a scenario entitled "Peloponnesian Wars" which has a global scenario ID of 23.  Then the
// permalink would be http://www.historyinmotion.info&scen=23.  The client, upon parsing this, would go a GET to the HiM
// server with route /get_permalink/23.  This avoids having to include the user's name, password, and scenario name in the
// permalink.
//
// To carry the scenario_id forward once we have it, form a closure that uses the retrieved/updated scenario ID as a parameter
// to a function that returns a function (bound to that value) that actually inserts the scenario into the database, along with
// its scenario ID.

function insertNewScenario (client, user, name, nameChanged, data, resp, done) {
  let scid = Math.floor(1000000000 * Math.random()) // Generate a global unique scenario identifier
  client.query('select name from scenarios where scid=$1', [scid], (err, result) => { // See if the scid is in use already
    if (err) {
      done()
      resp.statusCode = 500
      resp.send(err)
      return console.error(err)
    }
    if (result.rows.length == 0) { // No record found for this scid, so it's OK to use
      client.query('insert into scenarios (owner, name, data, scid) values ($1, $2, $3, $4)',
        [user, name, data, scid],
        (err, result) => {
          done()
          if (err) {
            resp.statusCode = 409
            resp.send(err)
            return console.error(err)
          }
          console.log("Inserting new scenario '" + name + "' for user " + user + ' with scid ' + scid)
          resp.send({ nameChanged: nameChanged, newName: ((nameChanged) ? name : ''), userWasOwner: false })
        })
    } else insertNewScenario(client, user, name, nameChanged, data, resp, done) // scid is in use, so try again with a different random scid
  })
}

// Given a permalink to a scenario and a username, do the following:
//    1. If the scenario is owned by the user, return the object { nameChanged: false, newName: "", userWasOwner: true }
//    2. Otherwise:
//      2a. If the scenario's name is unique for this user:
//        2a1. Save the scenario for this user with a new global scenario ID
//        2a2. Return the object { nameChanged: false, newName: "", userWasOwner: false }
//      2b. Otherwise:
//        2b1. Generate a sequence of names by appending successive integers to the scenario name until a unique name (for this user) is generated.
//        2b2. Save the scenario for this user with a new global scenario ID and the newly generated name
//        2b3. Return the object { nameChanged: true, newName: newly generated name, userWasOwner: false }
// The point of this is to ensure that the permalinked scenario is a scenario owned by the user, with a unique name (if the user didn't own it previously).
// Note that in case 2b, the client, upon getting a result with result.namedChanged == true, will invoke the server to update the newly named scenario, since
// when the server originally writes it, the scenario body contains the OLD (original) name, not the newly generated one.

app.get('/make_scenario_unique/:user/:scid', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      done()
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('select owner, name, data from scenarios where scid = $1',
      [req.params.scid], (err, result) => {
        if (err) {
          done()
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        }
        if (result.rows.length == 0) {
          // Couldn't find this scenario
          done()
          resp.statusCode = 404 // status code = "Not found"
          resp.send('Could not find scenario with permalink ' + req.params.scid)
        } else { // We found 1 record for this permalink (scid)
          let record = result.rows[0]
          if (req.params.user == record.owner) { // Case 1 above: permalinked scenario is owned by the user logged in to the client
            console.log('make_scenario_unique: permalink ' + req.params.scid + ' is already owned by ' + req.params.user)
            done()
            resp.send({ nameChanged: false, newName: '', userWasOwner: true })
          } else { // Case 2 above: permalinked scenario is owned by someone other than the user
            let genNextName = (seqno, tempName, nameChanged) => {
              client.query('select data from scenarios where owner = $1 and name = $2',
                [req.params.user, tempName], (err, result) => {
                  if (err) {
                    done()
                    resp.statusCode = 500 // status code = "Error"
                    resp.send(err)
                    return console.error(err)
                  }
                  if (result.rows.length == 0) { // No scenario found for this user and tempName, so insert it
                    resp.send({ nameChanged: nameChanged, newName: tempName, userWasOwner: false })
                  } else { // generate a new temp name and try again
                    seqno++
                    let maxAllowableLength // Max length of scenario "root" name, less a hyphen and a sequence number
                    if (seqno < 10) maxAllowableLength = 38
                    else if ((seqno >= 10) && (seqno < 100)) maxAllowableLength = 37
                    else maxAllowableLength = 36
                    let hyphen = tempName.indexOf('-')
                    if (hyphen > 0) tempName = tempName.substring(0, hyphen) // Strip off the hyphen
                    if (tempName.length > maxAllowableLength) tempName = tempName.substr(0, maxAllowableLength)
                    tempName = tempName + '-' + seqno
                    genNextName(seqno, tempName, true)
                  }
                })
            }
            genNextName(0, record.name, false) // Look for a unique name for scenario, starting with its original name
          }
        }
      })
  })
})

// Insert or update one scenario.
app.post('/update_scenario/:owner/:name', multer({ dest: './tmp' }).any(), (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    if (req.body.newscenario == 'true') { // Insert a new scenario into the database
      insertNewScenario(client, req.params.owner, req.params.name, true, req.body.data, resp, done)
    } else { // Update an existing scenario in the database
    // First, get the scenario version number and increment it
      client.query('select version from scenarios where owner = $1 and name = $2',
        [req.params.owner, req.params.name],
        (err, result) => {
          if (err) {
            done()
            resp.statusCode = 500 // status code = "Error"
            resp.send(err)
            return console.error(err)
          } else { // Get and increment the version number
          // Should NEVER be the case that result.rows.length == 0.  That would imply that the scenario is being updated before its creation
          // hase been recorded in the database.  However, the server has blown up because result.rows[0] was undefined.  So put this check in
          // as extra protection.
            let version = (result.rows.length == 0) ? 0 : result.rows[0].version
            version++
            // Now update the body of the scenario and its version number
            client.query('update scenarios set data = $3, version = $4 where owner = $1 and name = $2',
              [req.params.owner, req.params.name, req.body.data, version],
              (err, result) => {
                done()
                if (err) {
                  resp.statusCode = 500 // status code = "Error"
                  resp.send(err)
                  return console.error(err)
                } else { // Success
                  console.log("Updated scenario '" + req.params.name + "' to version " + version + ' for user ' + req.params.owner)
                  resp.send(req.params.name)
                }
              })
          }
        })
    }
  })
})

// Rename and update one scenario.
app.post('/rename_scenario/:owner/:oldname/:newname', multer({ dest: './tmp' }).any(), (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('update scenarios set (name, data) = ($3, $4) where owner = $1 and name = $2',
      [req.params.owner, req.params.oldname, req.params.newname, req.body.data],
      (err, result) => {
        done()
        if (err) {
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        } else { // Success
          console.log("Renamed scenario '" + req.params.oldname + "' to be '" + req.params.newname + "' for user " + req.params.owner)
          resp.send('Renamed and updated scenario ' + req.params.newname)
        }
      })
  })
})

// Delete one scenario.
app.delete('/scenario/:owner/:name', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('delete from scenarios where owner = $1 and name = $2',
      [req.params.owner, req.params.name],
      (err, result) => {
        done()
        if (err) {
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        } else { // Success
          console.log("Deleted scenario '" + req.params.name + "' for user " + req.params.owner)
          resp.send('Deleted scenario ' + req.params.newname)
        }
      })
  })
})

// Save an external file (icon, image, video, audio).

app.post('/save_file/:user/:filename', multer({ dest: './tmp' }).any(), (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      done()
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('insert into external_files (xfowner, xffilename, xfdata) values ($1, $2, $3)',
      [req.params.user, req.params.filename, fs.readFileSync(req.files.data.path)],
      (err, result) => {
        if (err) {
          done()
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        }
        done()
        resp.send('Saved file ' + req.params.filename + ' for user ' + req.params.user)
        fs.unlink(req.files.data.path, (err) => {
          if (err) {
            console.log('Failed to delete temp file: ' + req.files.data.path)
            console.log(err)
          }
        })
      }
    )
  })
})

// Copy an external file (icon, image, video, audio)

app.get('/copy_file/:user1/:filename1/:user2/:filename2', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      done()
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('select xfdata from external_files where xfowner = $1 and xffilename = $2',
      [req.params.user1, req.params.filename1],
      (err, result) => {
        if (err) {
          done()
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        }
        client.query('insert into external_files (xfowner, xffilename, xfdata) values ($1, $2, $3)',
          [req.params.user2, req.params.filename2, result.rows[0].xfdata],
          (err, result) => {
            if (err) {
              done()
              resp.statusCode = 500 // status code = "Error"
              resp.send(err)
              return console.error(err)
            }
            done()
            console.log('Copied file ' + req.params.user1 + '/' + req.params.filename1 + ' to ' + req.params.user2 + '/' + req.params.filename2)
            resp.send('Copied file ' + req.params.user1 + '/' + req.params.filename1 + ' to ' + req.params.user2 + '/' + req.params.filename2)
          }
        )
      }
    )
  })
})

// Retrieve an external file (icon, image, video, audio)

app.get('/get_file/:user/:filename', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      done()
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('select xfdata from external_files where xfowner = $1 and xffilename = $2',
      [req.params.user, req.params.filename],
      (err, result) => {
        if (err) {
          done()
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        }
        done()
        resp.send(result.rows[0].xfdata)
      }
    )
  })
})

// Delete an external file (icon, image, video, audio)

app.get('/delete_file/:user/:filename', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      done()
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('delete from external_files where xfowner = $1 and xffilename = $2',
      [req.params.user, req.params.filename],
      (err, result) => {
        if (err) {
          done()
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        }
        done()
        resp.send('Deleted file external_files/' + req.params.user + '/' + req.params.filename)
      }
    )
  })
})

// Save a historical map.

app.post('/save_map/', multer({ dest: './tmp' }).any(), (req, resp) => {
  console.log('Handling save_map with payload ' + JSON.stringify(req.files.data))
  pg.connect((err, client, done) => {
    if (err) {
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    insertNewMap(client, req.body.options, req.body.manager, req.files.data, resp, done) // Insert the new map
  })
})

// Helper function to actually insert a historical map.  Parameters:
//    client      Postgres client object from a successful opening of the database
//    options      Map options (see storage.saveMap_Async)
//    manager      "GME" or "MapTiler" (see storage.saveMap_Async)
//    data      if manager == "MapTiler", this is the fileObject of the zip file containing the map  (see storage.saveMap_Async)
//    resp      Express object which is the response to be sent back to the client
//    done      Function to call to release Postgres client

function insertNewMap (client, options, manager, data, resp, done) {
  let mapid = Math.floor(1000000000 * Math.random()) // Generate a global unique map identifier
  client.query('select mapdata from maps where mapid=$1', [mapid], (err, result) => { // See if the mapid is in use already
    if (err) {
      done()
      resp.statusCode = 500
      resp.send(err)
      return console.error(err)
    }
    if (result.rows.length == 0) { // No record found for this mapid, so it's OK to use
      switch (manager) {
        case 'GME': // Nothing more to do with a Google Maps Engine-managed map
          client.query('insert into maps (mapid, mapdata) values ($1, $2)',
            [mapid, options],
            (err, result) => {
              done()
              if (err) {
                resp.statusCode = 409
                resp.send(err)
                return console.error(err)
              }
              resp.send()
            }
          )
          break

          // If this is a MapTiler-managed map, then we need to do the following:
          //    1. Convert the fileContents to binary.
          //    2. Point AdmZip to that converted buffer.
          //    3. Read off the zipped entries.
          //    4. Save the unzipped entries that correspond to files (not directories) in the maptilermap database table.

        case 'MapTiler':
          let foundMTmetadata = false // Did we find a metadata.json file with valid values?
          let zip = new AdmZip(data.path)
          let zipEntries = zip.getEntries()
          let zipEntriesToInsert = []
          let index = 0
          for (let i = 0; i < zipEntries.length; i++) {
            if (!zipEntries[i].isDirectory) {
              // Depending on how the user zipped the MapTiler output, the .png files and the metadata.json file
              // may be an unknown level of directories deep in the zip file.  So just look at the last component
              // of every (non-directory) zip file entry, and "count back" the number of needed name components
              // from there, rather than assume a fixed number of directory levels.

              let nameComponents = zipEntries[i].entryName.split('/') // Will be "zoom,x, and y.png"
              if (nameComponents[0] == '__MACOSX') continue // 3/5/16: For some reason, MAC OS X has started putting extra files in the directory -- skip over them
              let k = nameComponents.length
              // Do a sanity check on the name components, just in case the user sent us a bogus zip file.  (Client checks that it *is* a zip file before uploading it.)
              if ((nameComponents[k - 1].indexOf('.png') > 0) && (k >= 3)) {
                if ((isNaN(nameComponents[k - 3])) || // Zoom
                          (isNaN(nameComponents[k - 2])) || // x
                          (isNaN(nameComponents[k - 1].substring(0, nameComponents[k - 1].indexOf('.png')))) // y
                ) {
                  done()
                  resp.statusCode = 409
                  let err = 'Illegal MapTiler file name: ' + zipEntries[index].entryName
                  resp.send(err)
                  return console.error(err)
                }
                zipEntriesToInsert[index] = [mapid, nameComponents[k - 3], nameComponents[k - 2], nameComponents[k - 1].substring(0, nameComponents[k - 1].indexOf('.png')), zip.readFile(zipEntries[i])]
                index++
              } else if (nameComponents[k - 1] == 'metadata.json') {
                // MT's metadata.json file has key parameters for the map.
                // We can only insert this map into the maps table if we have a valid metadata.json file.

                let metadata = JSON.parse(zip.readAsText(zipEntries[i]))
                let optionsWithMetadata = JSON.parse(options) // De-JSONify the options because we need to add to them
                optionsWithMetadata.minZoom = metadata.minzoom
                optionsWithMetadata.maxZoom = metadata.maxzoom
                let error = false
                if ((isNaN(optionsWithMetadata.minZoom)) || isNaN(optionsWithMetadata.maxZoom)) error = true
                let temp = metadata.bounds.split(',')
                if (temp.length == 4) {
                  optionsWithMetadata.bounds = { west: temp[0], south: temp[1], east: temp[2], north: temp[3] }
                  if ((isNaN(optionsWithMetadata.bounds.west)) || (optionsWithMetadata.bounds.west > 180) || (optionsWithMetadata.bounds.west < -180)) error = true
                  if ((isNaN(optionsWithMetadata.bounds.east)) || (optionsWithMetadata.bounds.east > 180) || (optionsWithMetadata.bounds.east < -180)) error = true
                  if ((isNaN(optionsWithMetadata.bounds.north)) || (optionsWithMetadata.bounds.north > 90) || (optionsWithMetadata.bounds.north < -90)) error = true
                  if ((isNaN(optionsWithMetadata.bounds.south)) || (optionsWithMetadata.bounds.south > 90) || (optionsWithMetadata.bounds.south < -90)) error = true
                } else error = true // Must have all four bounds
                if (error) {
                  done()
                  let err = 'Invalid field value for minzoom, maxzoom, or bounds in metadata.json file'
                  resp.statusCode = 409
                  resp.send(err)
                  return console.error(err)
                }
                foundMTmetadata = true // We have valid metadata for this map, so it's OK to insert the sections (the .png files)
                client.query('insert into maps (mapid, mapdata) values ($1, $2)',
                  [mapid, JSON.stringify(optionsWithMetadata)],
                  (err, result) => {
                    done()
                    if (err) {
                      resp.statusCode = 409
                      resp.send(err)
                      return console.error(err)
                    }
                  }
                )
                break
              }
            }
          }
          if (foundMTmetadata) insertNewMTMapSection(zipEntriesToInsert, 0, client, done, resp, data.path) // Recursively insert all zip entries that are the PNG files representing map sections
          else {
            done()
            let err = 'Unable to find valid metadata file for this MapTiler map'
            resp.statusCode = 409 // If we couldn't find the map metadata, we can't add the map
            resp.send(err)
            return console.error(err)
          }
      }
    } else insertNewMap(client, options, manager, data, resp, done) // There was a map with this mapID, so try again with another random number.
  })
}

// insertNewMTMapSection is called from insertNewMap to insert a database entry corresponding to a section of a MapTiler map.  MapTiler assumes it is looking for a "section" file named
// zoom/x/y.png, where zoom, x and y are positive integers: zoom is the initial zoom for this map view, and x and y represent map bounds (see www.maptiler.com
// for more details; we don't care what they mean as long as they have meaning to MapTiler).  insertNewMTMapSection inserts an entry with the map's mapID,
// the zoom, x, and y values (NO ".png"), and the map section PNG image.  If the insertion was successful, it recursively calls itself to insert the
// next section (if there is one), otherwise it returns failure to the client.  If this was the last section, report success to the client and return.

function insertNewMTMapSection (zipEntriesToInsert, index, client, done, resp, tempZipFilePath) {
  async.eachLimit(zipEntriesToInsert, 20, (z, callback) => {
    client.query('insert into maptilermaps (mtid, mtzoom, mtx, mty, mtblock) values ($1, $2, $3, $4, $5)',
      [z[0], z[1], z[2], z[3], z[4]],
      (err) => {
        done()
        if (err) {
          resp.statusCode = 409
          resp.send(err)
          callback(err)
          return console.error(err)
        }
      })
    callback() // async's functions require the callback to be called with a null argument on success
  },
  (err) => {
    done()
    if (err) {
      resp.statusCode = 409
      resp.send(err)
      callback(err)
      return console.error(err)
    } else {
      resp.send() // Report success to the client
      fs.unlink(tempZipFilePath, (err) => {
        if (err) {
          console.log('Failed to delete temp file: ' + tempZipFilePath)
          console.log(err)
        }
      })
    }
  })
}

// Retrieve a list of all historical maps, in which each entry is { mapID: mapID from database, mapdata: mapdata from database }

app.get('/get_maps/', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      done()
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('select mapid, mapdata from maps',
      [],
      (err, result) => {
        if (err) {
          done()
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        }
        done()
        let mapList = []
        for (let i = 0; i < result.rows.length; i++) {
          mapList.push({
            mapID: result.rows[i].mapid,
            mapdata: result.rows[i].mapdata
          })
        }
        resp.send(mapList)
      }
    )
  })
})

// Retrieve a single historical map entry of the form { mapID: mapID from database, mapdata: mapdata from database }

app.get('/get_map/:mapid', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      done()
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('select mapdata from maps where mapid = $1',
      [req.params.mapid],
      (err, result) => {
        done()
        if (err) {
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        }
        if (result.rows.length != 1) {
          resp.statusCode = 404 // status code = not found (or too many, which is an internal db error -- that should never happen
          resp.send('Map ' + req.params.mapid + ' not found')
          return console.error('Map ' + req.params.mapid + ' not found')
        }
        console.log('Returning entry for historical map ' + req.params.mapid)
        resp.send({
          mapID: req.params.mapid,
          mapdata: result.rows[0].mapdata
        })
      }
    )
  })
})

// Retrieve a single segment of a MapTiler map, given the global mapID, the zoom, and the MapTiler x and y coordinates.

app.get('/get_MT_segment/:mapid/:zoom/:x/:y', (req, resp) => {
  pg.connect((err, client, done) => {
    if (err) {
      done()
      resp.statusCode = 500 // status code = "Error"
      resp.send(err)
      return console.error(err)
    }
    client.query('select mtblock from maptilermaps where mtid = $1 and mtzoom = $2 and mtx = $3 and mty = $4',
      [req.params.mapid, req.params.zoom, req.params.x, req.params.y],
      (err, result) => {
        done()
        if (err) {
          resp.statusCode = 500 // status code = "Error"
          resp.send(err)
          return console.error(err)
        }
        if (result.rows.length != 1) {
          resp.statusCode = 404 // status code = not found (or too many, which is an internal db error -- that should never happen
          resp.send('Map ' + req.params.mapid + ' segment ' + req.params.zoom + '/' + req.params.x + '/' + req.params.y + ' not found')
          return console.error('Map ' + req.params.mapid + ' segment ' + req.params.zoom + '/' + req.params.x + '/' + req.params.y + ' not found')
        }
        console.log('Returning entry for historical map ' + req.params.mapid + ' segment ' + req.params.zoom + '/' + req.params.x + '/' + req.params.y)
        resp.set('Content-Type', 'image/png')
        resp.send(result.rows[0].mtblock)
      }
    )
  })
})

app.get('/auth/google', passport.authenticate('google', { scope: 'https://www.googleapis.com/auth/plus.login' }))

app.get('/auth/google/callback',
  passport.authenticate(
    'google',
    { failureRedirect: '/' }),
  (req, res) => {
    res.cookie('him_google_user', req.session.passport.user)
    res.redirect('/')
  }
)

// Entry point.
let port = process.env.PORT || 5000
app.listen(port, () => {
  console.log('Listening on ' + port)
})

export { }
