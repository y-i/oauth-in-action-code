const express = require("express");
const bodyParser = require('body-parser');
const cons = require('consolidate');
const nosql = require('nosql').load('database.nosql');
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
	var inToken = null;
	var auth = req.headers['authorization'];
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

const savedWords = [];

app.get('/words', getAccessToken, requireAccessToken, function(req, res) {
	if (!req.access_token.scope.includes('read')) {
		res.set('WWW-Authenticate', 'Bearer realm=localhost:9002, error="insufficient_scope", scope="read"');
		res.status(403).end();
		return;
	}
	res.json({words: savedWords.join(' '), timestamp: Date.now()});
});

app.post('/words', getAccessToken, requireAccessToken, function(req, res) {
	if (!req.access_token.scope.includes('write')) {
		res.set('WWW-Authenticate', 'Bearer realm=localhost:9002, error="insufficient_scope", scope="write"');
		res.status(403).end();
		return;
	}
	if (req.body.word) {
		savedWords.push(req.body.word);
	}
	res.status(201).end();
});

app.delete('/words', getAccessToken, requireAccessToken, function(req, res) {
	if (!req.access_token.scope.includes('delete')) {
		res.set('WWW-Authenticate', 'Bearer realm=localhost:9002, error="insufficient_scope", scope="delete"');
		res.status(403).end();
		return;
	}
	savedWords.pop();
	res.status(204).end();
});

var server = app.listen(9002, 'localhost', function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('OAuth Resource Server is listening at http://%s:%s', host, port);
});
 
