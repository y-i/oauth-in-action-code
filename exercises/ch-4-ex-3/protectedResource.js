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

app.get('/produce', getAccessToken, requireAccessToken, function(req, res) {
	const produce = {
		fruit: [], 
		veggies: [], 
		meats: [],
		lowcarbs: [],
	};	
	if (req.access_token.scope.includes('fruit')) {
		produce.fruit = ['apple', 'banana', 'kiwi'];
	}
	if (req.access_token.scope.includes('veggies')) {
		produce.veggies = ['lettuce', 'onion', 'potato'];
	}
	if (req.access_token.scope.includes('meats')) {
		produce.meats = ['bacon', 'steak', 'chicken breast'];
	}
	if (req.access_token.scope.includes('lowcarb')) {
		produce.lowcarbs = ['something lowcarb'];
	}

	res.json(produce);
});

const server = app.listen(9002, 'localhost', function () {
  const host = server.address().address;
  const port = server.address().port;

  console.log('OAuth Resource Server is listening at http://%s:%s', host, port);
});
 
