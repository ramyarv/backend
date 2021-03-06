require('express-async-errors');
const express = require('express');
const cors = require('cors')({origin: true});
const categories = require('../api/category');
const products = require('../api/product');
const operations = require('../api/operation');
const units = require('../api/unit');
const audits = require('../api/audit');
const branches = require('../api/branch');
const users = require('../api/users');
const roles = require('../api/roles');
const transactions = require('../api/transactions');
const inventories = require('../api/inventory');
const actions = require('../api/action');
const transferRequests = require('../api/transferRequests');
const reports = require('../api/report');
const metadata = require('../api/metadata')
const dashboard = require('../api/dashboard')
const { isAuthenticated } = require('../middleware/auth');
const httperror = require('../middleware/error');

module.exports = function(app) {
    app.use(cors);
    app.use(isAuthenticated)
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));
    app.use('/api/categories', categories);
    app.use('/api/products', products);
    app.use('/api/operations', operations);
    app.use('/api/units', units);
    app.use('/api/audits', audits);
    app.use('/api/branches', branches);
    app.use('/api/users', users);
    app.use('/api/roles', roles);
    //app.use('/api/permissions', permissions);
    app.use('/api/inventories', inventories);
    app.use('/api/transactions',transactions);
    app.use('/api/actions', actions);
    app.use('/api/transferRequests', transferRequests);
    app.use('/api/reports', reports);
    app.use('/api/metadata', metadata);
    app.use('/api/dashboard', dashboard);
    app.use(httperror);
}