# History in Motion Operational Procedures

## Setting Up Your Dev Environment

### Fetch the code

This is easy. Go to wherever you like to store your local git clients, and type:

```
git clone git@github.com:jleen/historyinmotion.git
```

This should give you a `historyinmotion` directory. This is where the server code lives. It’s a a git repository, so you can `git pull --rebase` and `git commit` and `git push`, just like you normally would.


### Install the Heroku environment

You need the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli#download-and-install).

It’s a self-installing download. Once it’s installed, open a new command shell and type `heroku login`. If everything’s good, it will prompt you for the credentials that you set up when you created your Heroku account.

If everything’s not good, this is the place it’ll most likely complain. Lemme know and we’ll debug.

You’ll need to associate your git repository with the Heroku app. Go to your `historyinmotion` directory and type:

```
heroku git:remote -a historyinmotion
```


### Install Postgres

This is the SQL database that we’ll use. It’s a competitor to MySQL. They both seem to be fine databases, and Heroku’s support for Postgres is said to be more mature. (It was the first database they offered.) I’ve already started running a Postgres instance for us on the Heroku cloud, but you’ll want to run Postgres on your Mac for development purposes. You can install it from: http://postgresapp.com/

As before, you’ll want to make sure the postgres app is available on your path when you start a new command line. (Try typing `pg_ctl`. If all is well, it’ll give you a message like “no operation specified”. If all is not well, it’ll say “command not found”.)

You may want to create an alias in your .bashrc:

```
alias pg_ctl='pg_ctl -D ~/Library/Postgres -l ~/Library/Postgres/server.log’
```

You’re going to be typing `pg_ctl` a lot, and you’ll nearly always want it to have those -D and -l options.


### Clone the server database to your Mac

This is the fun part. We’re going to instruct Heroku to fetch a copy of the History in Motion database to your Mac. You’ll be doing this a lot at first, as I get the server database into a usable state. 

First, instruct Heroku to create a snapshot of the server database. `cd historyinmotion`, and then issue these two commands:

```
heroku pgbackups:capture
curl -o latest.dump `heroku pgbackups:url`
```

This should create a file called latest.dump in the current directory.

Now, tell Postgres to create an empty database on your Mac:

```
initdb ~/Library/Postgres
```

Start the server (assuming you set up an alias as I suggested in part 3).

```
pg_ctl start
```

Create a local database called historyinmotion:

```
createdb historyinmotion
```

And tell postgres to blast the contents of this backup into a local database called historyinmotion (**wiping any information in that local database if it already exists**):

```
pg_restore --verbose --clean --no-acl --no-owner -h localhost -d historyinmotion latest.dump
```
 

### Set up the local server

In the `historyinmotion` directory, create a file called .env for your local config. Probably the contents you want are:

```
PORT=5555
DATABASE_URL="postgres://localhost/historyinmotion”
GOOGLE_CALLBACK_URL="http://localhost:5555/auth/google/callback"
STATIC_CLIENT_CONTENT_DIR="client"
GOOGLE_CLIENT_ID=”XXXX”
GOOGLE_CLIENT_SECRET=”YYYY”
COOKIE_SECRET=”ZZZZ”
```

This will tell the app what port to bind to (localhost:5555), and where to find the database. The values XXXX, YYYY, and ZZZZ are secret values that we should not store in insecure places, but which we can fetch directly from heroku with the command:

```
heroku config
```
from within the `historyinmotion` directory.


### Run the local server

Here are the commands you care about. To turn Postgres on or off:

```
pg_ctl start
pg_ctl stop
```

You care about these because you need it running when you run historyinmotion, but you probably don’t want an extraneous server process consuming CPU and memory when you aren’t working on historyinmotion.

To run historyinmotion once Postgres is running:

```
heroku local
```

This should spew a bunch of logging info and stay active. To shut down historyinmotion, just ^C in this window.

To test that historyinmotion is working, just browse to http://localhost:5555/ and see if it says “Hello world”. To test that historyinmotion can connect to postgres, browse to http://localhost:5555/scenario/jleen (actually use “jleen”, not your name) and see if it spits out a little JSON blob containing the words “Try” and “apple”. This data comes from the SQL database, so if it shows up then everything is working.

Finally, at some point you might want to connect directly to the SQL database to issue SQL commands by hand. To talk to your local database, do:
	psql historyinmotion

If you have any need to talk directly to the server database, you do this by cd’ing into the historyinmotion directory and asking Heroku to connect you to its cloud Postgres:

```
heroku pg:psql
```


## Deploying the Server

Prepare for a push as follows:

- Edit the appropriate xlsx files in the historyinmotion project, to track your release.
- Commit and push your changes.
- Use `git tag` (followed by a version number) to tag the release. Then `git push --tags`.

To actually deploy the new version to the public servers:

```
git push heroku master
```
