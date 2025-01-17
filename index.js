
const fetch = require('node-fetch');
var languages = require('./languages');

function extract(key, res) {
    var re = new RegExp(`"${key}":".*?"`);
    var result = re.exec(res.body);
    if (result !== null) {
        return result[0].replace(`"${key}":"`, '').slice(0, -1);
    }
    return '';
}

function request (url, requestOptions, body) {
    const fetchinit = {
        ...requestOptions,
        headers: requestOptions.headers,
        credentials: requestOptions.credentials || 'omit',
        body: body
    };
    return fetch(url, fetchinit).then(res => res.text());
};


function translate(input, opts, requestOptions) {
    opts = opts || {};
    requestOptions = requestOptions || {};

    var e;
    [[opts.from, opts.forceFrom], [opts.to, opts.forceTo]].forEach(function ([lang, force]) {
        if (!force && lang && !languages.isSupported(lang)) {
            e = new Error();
            e.code = 400;
            e.message = 'The language \'' + lang + '\' is not supported';
        }
    });

    if (e) {
        return new Promise(function (resolve, reject) {
            reject(e);
        });
    }

    opts.from = opts.from || 'auto';
    opts.to = opts.to || 'en';
    opts.tld = opts.tld || 'com';
    opts.autoCorrect = opts.autoCorrect === undefined ? false : Boolean(opts.autoCorrect);

    opts.from = opts.forceFrom ? opts.from : languages.getCode(opts.from);
    opts.to = opts.forceTo ? opts.to : languages.getCode(opts.to);

    var url = 'https://translate.google.' + opts.tld;

    requestOptions.method = 'GET';

    // according to translate.google.com constant rpcids seems to have different values with different POST body format.
    // * MkEWBc - returns translation
    // * AVdN8 - return suggest
    // * exi25c - return some technical info
    var rpcids = 'MkEWBc';
    return request(url, requestOptions).then(function (res) {
        var data = {
            'rpcids': rpcids,
            'source-path': '/',
            'f.sid': extract('FdrFJe', res),
            'bl': extract('cfb2h', res),
            'hl': 'en-US',
            'soc-app': 1,
            'soc-platform': 1,
            'soc-device': 1,
            '_reqid': Math.floor(1000 + (Math.random() * 9000)),
            'rt': 'c'
        };

        return data;
    }).then(function (data) {
        // === format for freq below is only for rpcids = MkEWBc ===
        const queryParams = new URLSearchParams(data);

        url = url + '/_/TranslateWebserverUi/data/batchexecute?' + queryParams.toString();
        requestOptions.method = 'POST';
        requestOptions.headers = {
            ...requestOptions.headers,
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        };

        const textArray = Array.isArray(input) ? input : (typeof input === 'object' ? Object.values(input) : [input]);

        const textRequests = [];

        for (const text of textArray) {
            const freq = [[[rpcids, JSON.stringify([[text, opts.from, opts.to, opts.autoCorrect], [null]]), null, 'generic']]];
            const body = 'f.req=' + encodeURIComponent(JSON.stringify(freq)) + '&';

            textRequests.push(
                request(url, requestOptions, body).then(function (res) {
                    var json = res.slice(6);
                    var length = '';

                    var result = {
                        text: '',
                        pronunciation: '',
                        from: {
                            language: {
                                didYouMean: false,
                                iso: ''
                            },
                            text: {
                                autoCorrected: false,
                                value: '',
                                didYouMean: false
                            }
                        },
                        raw: ''
                    };

                    try {
                        length = /^\d+/.exec(json)[0];
                        json = JSON.parse(json.slice(length.length, parseInt(length, 10) + length.length));
                        json = JSON.parse(json[0][2]);
                        result.raw = json;
                    } catch (e) {
                        return result;
                    }

                    if (json[1][0][0][5] === undefined || json[1][0][0][5] === null) {
                        // translation not found, could be a hyperlink or gender-specific translation?
                        result.text = json[1][0][0][0];
                    } else {
                        result.text = json[1][0][0][5]
                            .map(function (obj) {
                                return obj[0];
                            })
                            .filter(Boolean)
                            // Google api seems to split text per sentences by <dot><space>
                            // So we join text back with spaces.
                            // See: https://github.com/vitalets/google-translate-api/issues/73
                            .join(' ');
                    }
                    result.pronunciation = json[1][0][0][1];

                    // From language
                    if (json[0] && json[0][1] && json[0][1][1]) {
                        result.from.language.didYouMean = true;
                        result.from.language.iso = json[0][1][1][0];
                    } else if (json[1][3] === 'auto') {
                        result.from.language.iso = json[2];
                    } else {
                        result.from.language.iso = json[1][3];
                    }

                    // Did you mean & autocorrect
                    if (json[0] && json[0][1] && json[0][1][0]) {
                        var str = json[0][1][0][0][1];

                        str = str.replace(/<b>(<i>)?/g, '[');
                        str = str.replace(/(<\/i>)?<\/b>/g, ']');

                        result.from.text.value = str;

                        if (json[0][1][0][2] === 1) {
                            result.from.text.autoCorrected = true;
                        } else {
                            result.from.text.didYouMean = true;
                        }
                    }

                    return result;
                }).catch(function (err) {
                    err.message += `\nUrl: ${url}`;
                    if (err.statusCode !== undefined && err.statusCode !== 200) {
                        err.code = 'BAD_REQUEST';
                    } else {
                        err.code = 'BAD_NETWORK';
                    }
                    throw err;
                })
            );
        }

        return Promise.all(textRequests).then(textResponses => {
            if (Array.isArray(input)) {
                return textResponses;
            } else if (typeof input === 'object') {
                const result = {};
                Object.keys(input).forEach((key, index) => {
                    result[key] = textResponses[index];
                });
                return result;
            }
            return textResponses[0];
        });
    });
}

module.exports = translate;
module.exports.languages = languages;
