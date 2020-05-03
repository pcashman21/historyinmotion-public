CREATE TABLE users (
	uname			VARCHAR(40) PRIMARY KEY,
	upassword		VARCHAR(20),
	upassword_temp	VARCHAR(20) DEFAULT NULL,
	uemail			VARCHAR(50) NOT NULL,
	udata			VARCHAR(1000),
	ulogin_first	TIMESTAMP WITH TIME ZONE,
	ulogin_last		TIMESTAMP WITH TIME ZONE,
	ulogin_count	INTEGER DEFAULT 1
);

CREATE TABLE scenarios (
	owner		VARCHAR(40) NOT NULL,
	name		VARCHAR(40) NOT NULL,
	data		VARCHAR(10000000),
	scid		INTEGER NOT NULL,
	version		INTEGER DEFAULT 0,
	PRIMARY KEY (scowner, scname)
);

CREATE TABLE external_files (
	xfowner		VARCHAR(40) NOT NULL,
	xffilename	VARCHAR(12) NOT NULL,
	xfdata		BYTEA,
	PRIMARY KEY	(xfowner, xffilename)
);

CREATE TABLE maps (
	mapID		INTEGER PRIMARY KEY NOT NULL,
	mapdata		VARCHAR(100000)
);

CREATE TABLE maptilermaps (
	mtID		INTEGER NOT NULL,
	mtzoom		INTEGER NOT NULL,
	mtx			INTEGER NOT NULL,
	mty			INTEGER NOT NULL,
	mtblock		BYTEA,
	PRIMARY KEY (mtID, mtzoom, mtx, mty)
);