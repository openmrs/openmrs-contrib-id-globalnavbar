'use strict';
const path = require('path');
const url = require('url');
const express = require('express');
const cors = require('cors');

const mid = require('../../../express-middleware');
const conf = require('../../../conf');
const log = require('log4js').addLogger('global-navbar');
const flat = require('node-flat-db');
const db = flat(path.join(__dirname, '../data/db.json'), {
    storage: require('node-flat-db/file-async'),
});

const links = db('GlobalNavLinks');
const prefs = db('GlobalNavPrefs');
if (prefs.isEmpty()) {
    prefs.push(
        [{
            "key": "customCSS",
            "placeholder": "body {backgroud: magenta;}",
            "name": "Custom CSS",
            "type": "textarea",
            "value": "",
            "description": "Include any CSS to be inserted to the navbar."
        }, {
            "key": "cseId",
            "placeholder": "012345678901234567890:abcdefghijk",
            "name": "Google CSE ID",
            "value": "",
            "description": "Display a Google Custom Search field in the navbar by providing a CSE ID."
        }, {
            "key": "csePlaceholder",
            "placeholder": "Search",
            "name": "Search Placeholder",
            "value": "",
            "description": "Placeholder text displayed in the search field by default."
        }]
    );
    db.write().then(() => {
        log.debug("No database file found...creating one...");
    });
} else {
    log.info("You already set up the database...doing nothing");
}
const subApp = express();
subApp.set('view engine', 'pug');

// CORS support (allow navbar code to be loaded from different origins)
subApp.use(cors());

// request made by clients
subApp.get('/globalnav', (req, res, next) => {

    const links = db('GlobalNavLinks');
    const prefs = db('GlobalNavPrefs').value();

    // create settings object from prefs instances
    const prefsObj = {};
    prefs.forEach(inst => {
        prefsObj[inst.key] = inst.value;
    });

    const referrer = url.parse(req.header('Referer') || '');
    let bestMatch;
    let match;
    links.each(link => {
        const parsed = url.parse(link.url);
        if (referrer.host === parsed.host) {
            match = link.url;
            if (referrer.pathname.replace(/\/$/, '') === parsed.pathname.replace(/\/$/, '')) {
                bestMatch = link.url;
            }
        }
    });

    // render & send the page (along with render variables)
    res.render(`${__dirname}/../views/global-nav`, {
        links: links.value(),
        prefs: prefsObj,
        matche: bestMatch || match,
    });
});


subApp.use('/globalnav', express.static(path.join(__dirname, '/../resource/')));

exports = module.exports = app => {


    app.admin.addPage('Global Navigation', '/admin/globalnav');
    app.use(subApp);

    // panel for global navbar
    app.get('/admin/globalnav', (req, res, next) => {

        const links = db('GlobalNavLinks');
        const prefs = db('GlobalNavPrefs');
        const scriptURL = url.resolve(conf.site.url, '/globalnav/js/app-optimized.js');

        res.render(`${__dirname}/../views/globalnav-admin`, {
            links: links.value(),
            prefs: prefs.value(),
            scriptURL: scriptURL,
        });
    });



    //update links
    app.post('/admin/globalnav/links', mid.parseParamTable, (req, res, next) => {

        const params = res.locals.params;

        // refresh db
        const links = db('GlobalNavLinks');
        links.remove();

        for (const link in params) {
            log.debug(`creating link: ${JSON.stringify(params[link])}`);

            const inst = {};
            inst.id = params[link].id;
            inst.name = params[link].name;
            inst.url = params[link].url;

            links.push(inst);
        }
        db.write().then(() => {
            req.flash('success', 'Global navigation links updated.');
            res.redirect(303, '/admin/globalnav');
        });
    });

    app.post('/admin/globalnav/prefs', (req, res, next) => {

        const prefs = db('GlobalNavPrefs');
        for (const name in req.body) {
            log.debug(`finding config value ${name}`);
            const inst = prefs.find({
                key: name
            });
            inst.value = req.body[name];
            prefs.assign({
                key: inst.value
            });
        }
        db.write().then(() => {
            req.flash('success', 'Preferences updated.');
            res.redirect(303, '/admin/globalnav');
        });

    });


};