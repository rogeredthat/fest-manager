var express = require('express');
var fq = require('fuzzquire');
var middleware = fq('authentication').middleware;

var getOptions = function (data) {
	var options = {};
	if (data.page) {
		options.page = parseInt(data.page);
		options.limit = parseInt(data.limit) || 10;
	}
	if (data.fields) {
		options.select = data.fields.split(',').join(' ');
	}
	if (data.sort) {
		options.sort = {};
		options.sort[data.sort] = data.direction || 'asc';
	}
	return options;
};

function checkPermission(level) {
	return function (req, res, next) {
		if (level === 0) {
			return next();
		} else if (req.user && req.user.privilege && req.user.privilege.level >= level) {
			return next();
		} else {
			let error = new Error('Access denied');
			error.status = 401;
			return next(error);
		}
	};
}

function service(model, router, permission) {
	let methods = {};

	methods.get = (options) => {
		var promise;
		if (options.page) {
			promise = model.paginate({}, options);
		} else {
			promise = model.find({}, {}, options);
		}
		return promise;
	};

	router.get('/', checkPermission(permission.read_all), (req, res, next) => {
		var options = getOptions(req.query);
		promise = methods.get(options);
		promise.then(data => {
			res.json(data);
		}).catch(err => {
			console.log(err);
			res.status(500).send(err);
			return;
		});
	});

	router.get('/:id', checkPermission(permission.read_one), function (req, res, next) {
		model.findOne({
			_id: req.params.id
		}, function (err, item) {
			if (err) {
				console.log(err);
				res.status(500).send(err);
				return;
			}
			res.send(item);
		});
	});

	router.post('/get-one', middleware.authenticate, checkPermission(permission.insert), function (req, res, next) {
		model.findOne(req.body.filter, function (err, item) {
			if (err) {
				console.log(err);
				res.status(500).send(err);
				return;
			}
			res.send(item);
		});
	});
	methods.post = (rawData) => {
		let item = new model(rawData);
		return item.save();
	};
	router.post('/', checkPermission(permission.insert), function (req, res, next) {
		methods.post(req.body).then(data => {
			res.send({
				status: "Success",
				data: data,
			});
		}).catch(err => {
			console.log(err);
			res.status(500).send(err);
			return;
		});
	});

	router.put('/', checkPermission(permission.update), function (req, res, next) {
		model.update({
			_id: req.body._id || req.body.id
		}, req.body, function (err, data) {
			if (err) {
				console.log(err);
				res.status(500).send(err);
				return;
			}
			res.send({
				status: "Success",
				data: data,
			});
		});
	});

	router.delete('/:id', checkPermission(permission.delete), function (req, res, next) {
		model.findByIdAndRemove(req.params.id, function (err, data) {
			if (err) {
				console.log(err);
				res.status(500).send(err);
				return;
			}
			res.send({
				status: "Success",
				data: data,
			});
		});
	});

	router.put('/update-one', checkPermission(permission.update), function (req, res, next) {
		model.findOneAndUpdate(req.body.filter, // query
				{
					$set: req.body.data
				}, // operations
				{
					upsert: true
				}) // options
			.then(data => {
				return res.send({
					status: "Success",
					data: data,
				});
			})
			.catch(err => {
				console.log(err);
				res.status(500).send(err);
				return;
			});
	});
	return router;
}

module.exports = service;
