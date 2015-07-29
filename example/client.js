var express = require("express");
var request = require("sync-request");
var url = require("url");
var qs = require("qs");
var cons = require('consolidate');
var randomstring = require("randomstring");


var app = express();

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/client');

// authorization server information
var authServer = {
	authorizationEndpoint: 'http://localhost:9001/authorize',
	tokenEndpoint: 'http://localhost:9001/token'
};

// client information
var client = {
	"client_id": "oauth-client-1",
	"client_secret": "oauth-client-secret-1",
	"redirect_uri": "http://localhost:9000/callback",
	"scope": "foo"
};

var protectedResource = 'http://localhost:9002/resource';

var state = null;

var access_token = null;
var refresh_token = null;

app.get('/', function (req, res) {
	res.render('index', {access_token: access_token, refresh_token: refresh_token});
});

app.get('/authorize', function(req, res){
	
	access_token = null;
	refresh_token = null;
	state = randomstring.generate();
	
	var authorizeUrl = url.parse(authServer.authorizationEndpoint, true);
	delete authorizeUrl.search; // this is to get around odd behavior in the node URL library
	authorizeUrl.query.response_type = 'code';
	authorizeUrl.query.scope = client.scope;
	authorizeUrl.query.client_id = client.client_id;
	authorizeUrl.query.redirect_uri = client.redirect_uri
	authorizeUrl.query.state = state;
	
	console.log("redirect", url.format(authorizeUrl));
	res.redirect(url.format(authorizeUrl));
});


app.get("/callback", function(req, res){
	
	if (req.query.error) {
		// it's an error response, act accordingly
		res.render('error', {error: req.query.error});
		return;
	}
	
	var resState = req.query.state;
	if (resState == state) {
		console.log('State value matches: expected %s got %s', app.state, state);
	} else {
		console.log('State DOES NOT MATCH: expected %s got %s', app.state, state);
		res.render('error', {error: 'State value did not match'});
		return;
	}

	var code = req.query.code;

	var form_data = qs.stringify({
				grant_type: 'authorization_code',
				code: code,
				client_id: client.client_id,
				client_secret: client.client_secret,
				redirect_uri: client.redirect_uri
			});
	var headers = {
		'Content-Type': 'application/x-www-form-urlencoded'
	};

	var tokRes = request('POST', authServer.tokenEndpoint, 
		{	
			body: form_data,
			headers: headers
		}
	);

	console.log('Requesting access token for code %s',code);
	
	if (tokRes.statusCode >= 200 && tokRes.statusCode < 300) {
		var body = JSON.parse(tokRes.getBody());
	
		access_token = body.access_token;
		refresh_token = body.refresh_token;
	
		console.log('Got access token %s', access_token);
		console.log('Got refresh token %s', refresh_token);

		res.render('index', {access_token: access_token, refresh_token: refresh_token});
	} else {
		res.render('error', {error: 'Unable to fetch access token, server response: ' + tokRes.statusCode})
	}
});

app.get('/fetch_resource', function(req, res) {

	if (!access_token) {
		if (refresh_token) {
			// try to refresh and start again
			var form_data = qs.stringify({
						grant_type: 'refresh_token',
						refresh_token: refresh_token,
						client_id: client.client_id,
						client_secret: client.client_secret,
						redirect_uri: client.redirect_uri
					});
			var headers = {
				'Content-Type': 'application/x-www-form-urlencoded'
			};
			console.log('Refreshing token %s', refresh_token);
			var tokRes = request('POST', authServer.tokenEndpoint, 
				{	
					body: form_data,
					headers: headers
				}
			);
			if (tokRes.statusCode >= 200 && tokRes.statusCode < 300) {
				var body = JSON.parse(tokRes.getBody());
	
				access_token = body.access_token;
				console.log('Got access token: %s', access_token);
				if (body.refresh_token) {
					refresh_token = body.refresh_token;
				}
			
				// try again
				res.redirect('/fetch_resource');
				return;
			} else {
				console.log('No refresh token, asking the user to get a new access token');
				// tell the user to get a new access token
				res.redirect('/authorize');
				return;
			}
			
		} else {
			res.render('error', {error: 'Missing access token.'});
			return;
		}
	}
	
	console.log('Making request with access token %s', access_token);
	
	var headers = {
		'Authorization': 'Bearer ' + access_token
	};
	
	var resource = request('POST', protectedResource,
		{headers: headers}
	);
	
	if (resource.statusCode >= 200 && resource.statusCode < 300) {
		var body = JSON.parse(resource.getBody());
		res.render('data', {resource: body});
		return;
	} else {
		access_token = null;
		if (refresh_token) {
			// try to refresh and start again
			var form_data = qs.stringify({
						grant_type: 'refresh_token',
						refresh_token: refresh_token,
						client_id: client.client_id,
						client_secret: client.client_secret,
						redirect_uri: client.redirect_uri
					});
			var headers = {
				'Content-Type': 'application/x-www-form-urlencoded'
			};
			console.log('Refreshing token %s', refresh_token);
			var tokRes = request('POST', authServer.tokenEndpoint, 
				{	
					body: form_data,
					headers: headers
				}
			);
			if (tokRes.statusCode >= 200 && tokRes.statusCode < 300) {
				var body = JSON.parse(tokRes.getBody());
	
				access_token = body.access_token;
				console.log('Got access token: %s', access_token);
				if (body.refresh_token) {
					refresh_token = body.refresh_token;
				}
			
				// try again
				res.redirect('/fetch_resource');
				return;
			} else {
				console.log('No refresh token, asking the user to get a new access token');
				// tell the user to get a new access token
				res.redirect('/authorize');
				return;
			}
			
		} else {
			res.render('error', {error: 'Server returned response code: ' + resource.statusCode});
			return;
		}
	}
	
	
});

app.use('/', express.static('files/client'));

var server = app.listen(9000, 'localhost', function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('OAuth Client is listening at http://%s:%s', host, port);
});
 
