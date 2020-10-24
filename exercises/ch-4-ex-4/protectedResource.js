const express = require("express");
const bodyParser = require('body-parser');
const cons = require('consolidate');
const nosql = require('nosql').load('database.nosql');
const __ = require('underscore');
const cors = require('cors');

const app = express();

app.use(bodyParser.urlencoded({ extended: true })); // support form-encoded bodies (for bearer tokens)

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/protectedResource');
app.set('json spaces', 4);

app.use('/', express.static('files/protectedResource'));
app.use(cors());

const resource = {
	"name": "Protected Resource",
	"description": "This data has been protected by OAuth 2.0"
};

const getAccessToken = function(req, res, next) {
	let inToken = null;
	const auth = req.headers['authorization'];
	if (auth && auth.toLowerCase().indexOf('bearer') == 0) {
		inToken = auth.slice('bearer '.length);
	} else if (req.body && req.body.access_token) {
		inToken = req.body.access_token;
	} else if (req.query && req.query.access_token) {
		inToken = req.query.access_token
	}
	
	console.log('Incoming token: %s', inToken);
	nosql.find().make(builder => {
		builder.where('access_token', inToken);
		builder.callback((err, [token]) => {
			if (token) {
				console.log("We found a matching token: %s", inToken);
			} else {
				console.log('No matching token was found.');
			}
			req.access_token = token;
			next();
		});
	});
};

const requireAccessToken = function(req, res, next) {
	if (req.access_token) {
		next();
	} else {
		res.status(401).end();
	}
};

const createLimitedObject = (obj, scope) => {
	const ret = {movies: [], foods: [], music: []};
	if (scope.includes('movies')) {ret.movies = obj.movies;}
	if (scope.includes('foods')) {ret.foods = obj.foods;}
	if (scope.includes('music')) {ret.music = obj.music;}

	return ret;
};

const aliceFavorites = {
	'movies': ['The Multidmensional Vector', 'Space Fights', 'Jewelry Boss'],
	'foods': ['bacon', 'pizza', 'bacon pizza'],
	'music': ['techno', 'industrial', 'alternative']
};

const bobFavorites = {
	'movies': ['An Unrequited Love', 'Several Shades of Turquoise', 'Think Of The Children'],
	'foods': ['bacon', 'kale', 'gravel'],
	'music': ['baroque', 'ukulele', 'baroque ukulele']
};

app.get('/favorites', getAccessToken, requireAccessToken, function(req, res) {
	const {user, scope} = req.access_token;
	if (user === 'alice') {
		res.json({user: 'Alice', favorites: createLimitedObject(aliceFavorites, scope)});
	} else if (user == 'bob') {
		res.json({user: 'Bob', favorites: createLimitedObject(bobFavorites, scope)});
	} else {
		const unknown = {user: 'Unknown', favorites: {movies: [], foods: [], music: []}};
		res.json(unknown);
	}
});

const server = app.listen(9002, 'localhost', function () {
  const host = server.address().address;
  const port = server.address().port;

  console.log('OAuth Resource Server is listening at http://%s:%s', host, port);
});
 
