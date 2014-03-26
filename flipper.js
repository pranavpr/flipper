var request = require('request');
var cheerio = require('cheerio');
var zlib = require('zlib');

/**
 * Initialize Scraper
 * @return {null}
 */
function init() {
	// Make request to index of sitemap
	request('http://www.flipkart.com/sitemap/sitemap_index.xml', function(error, response, html) {
		if (!error && response.statusCode == 200) {
			var $ = cheerio.load(html);
			var locURL = [];
			// Make request for each sitemap URL in index of sitemap file
			$('loc').each(function(i, element) {
				var loc = $(this).text().trim();
				locURL.push(loc);
			});
			for (var j = 0; j < locURL.length; j++) {
				if (j < 17 || j > 48) { // Exclude some URLs as product info. is not there
					// Make request to each URL in sitemap
					makeRequest(locURL[j], function(response) {
						var arrURL = [];
						var $resp = cheerio.load(response);
						$resp('url').each(function(i, element) {
							var url = $resp(this).text().trim();
							arrURL.push(url);
						});
						for (var i = 0; i < 10; i++) {
							request(arrURL[i], function(error, response, html) {
								if (!error && response.statusCode == 200) {
									var $item = cheerio.load(html);
									var item = {
										date: new Date(),
										name: $item("h1[itemprop=name]").text().trim(),
										price: $item("meta[itemprop=price]").attr('content'),
										url: $item("meta[name=og_url]").attr('content'),
										image: $item("meta[name=og_image]").attr('content')
									};
									var MongoClient = require('mongodb').MongoClient,
										format = require('util').format;

									MongoClient.connect('mongodb://127.0.0.1:27017/flipdb', function(err, db) {
										if (err) throw err;

										var collection = db.collection('products1');
										collection.insert(item, function(err, docs) {
											collection.count(function(err, count) {
												console.log(format("count = %s", count));
											});
										});
										db.close();
									});
								}
							});
						};
					});
				};
			}
		}
	});
}

/**
 * Requests for gzipped sitemap and returns unzipped sitemap
 * @param  {string}   url
 * @param  {Function} callback
 * @return {null}
 */
function makeRequest(url, callback) {
	var headers = {
		'Accept-Encoding': 'gzip'
	};

	var response = request(url, headers);

	gunzipXML(response, function(unzippedXML) {
		callback(unzippedXML);
	});
}

/**
 * Unzips gzipped sitemap
 * @param  {stream}   response
 * @param  {Function} callback
 * @return {null}
 */
function gunzipXML(response, callback) {

	var gunzip = zlib.createGunzip();
	var XML = "";
	// Keep appending while data is found
	gunzip.on('data', function(data) {
		XML += data.toString();
	});
	// Return XML on end
	gunzip.on('end', function() {
		callback(XML);
	});

	response.pipe(gunzip);
}

init();