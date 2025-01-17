# google-translate-api-x
[![Actions Status](https://github.com/AidanWelch/google-translate-api/workflows/autotests/badge.svg)](https://github.com/AidanWelch/google-translate-api/actions)
[![NPM version](https://img.shields.io/npm/v/google-translate-api-x.svg)](https://www.npmjs.com/package/google-translate-api-x)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)

A **free** and **unlimited** API for Google Translate :dollar: :no_entry_sign: written with compatibility in mind, made to be crossplatform.

## Features 

- Up-to-Date with all new Google Translate supported languages!
- Auto language detection
- Spelling correction
- Language correction 
- Fast and reliable – it uses the same servers that [translate.google.com](https://translate.google.com) uses
- Wide compatibility through supporting Fetch, Axios, and custom request functions
- Array or Object input to limit API requests from 2n to n + 1

## Why this fork?
This fork of the fork [vitalets/google-translate-api](https://github.com/vitalets/google-translate-api) contains several improvements with the primary change being it is written to support various request methods instead of Got, allowing for greater compatibility outside of Node.js.  It also abandons the outdated `querystring`.  Additionally, new languages are more frequently added, and if a new language is not yet in the languages.js list you can now bypass it with the `forceFrom` and `forceTo` options. 

## Install 

```
npm install google-translate-api-x
```

## Usage

From automatic language detection to English:

```js
const translate = require('google-translate-api-x');
// Or of course
import translate from 'google-translate-api-x';

const res = await translate('Ik spreek Engels', {to: 'en'});

console.log(res.text); //=> I speak English
console.log(res.from.language.iso);  //=> nl
```

If server returns **Response code 403 (Forbidden)** try set option `client=gtx`:
```js
const res = await translate('Ik spreek Engels', { to: 'en', client: 'gtx' }).then(res => { ... });
```

> Please note that maximum text length for single translation call is **5000** characters. 
> In case of longer text you should split it on chunks, see [#20](https://github.com/vitalets/google-translate-api/issues/20).

### Autocorrect
From English to Dutch with a typo (autoCorrect):

```js
const res = await translate('I spea Dutch!', { from: 'en', to: 'nl', autoCorrect: true });

console.log(res.from.text.didYouMean); // => true
console.log(res.from.text.value); // => 'I [speak] Dutch!'

const correctedText = res.from.text.value.replace(/\[([a-z]+)\]/ig, '$1'); // => 'I speak Dutch!'
const finalRes = await translate(correctedText, { from: 'en', to: 'nl' });

console.log(finalRes.text); // => 'Ik spreek Nederlands!'
```

You can also add languages in the code and use them in the translation:
``` js
translate = require('google-translate-api-x');
translate.languages['sr-Latn'] = 'Serbian Latin';

translate('translator', {to: 'sr-Latn'}).then(res => ...);
```

### Array and Object inputs
An array or object of inputs can be used to slightly lower the number of individual API calls:

```js
const inputArray = [
  'I speak Dutch!',
  'Dutch is fun!',
  'And so is translating!'
];

const res = await translate(inputArray, { from: 'en', to: 'nl' });

console.log(res[0].text); // => 'Ik spreek Nederlands!'
console.log(res[1].text); // => 'Nederlands is leuk!'
console.log(res[2].text); // => 'En zo ook vertalen!'
```

and similarly with an object:

```js
const inputObject = {
  name: 'Aidan Welch',
  fact: 'I\'m maintaining this project',
  birthMonth: 'February'
};

const res = await translate(inputObject, { from: 'en', to: 'ja' });

console.log(res.name.text); // => 'エイダンウェルチ'
console.log(res.fact.text); // => '私はこのプロジェクトを維持しています'
console.log(res.birthMonth.text); // => '2月'
```

If you use `auto` each input can even be in a different language!

### Using languages not supported in languages.js yet
If you know the ISO code used by Google Translate for a language and know it is supported but this API doesn't support it yet you can force it like so:

```js
const res = await translate('Hello!', { from: 'en', to: 'as', forceTo: true });

console.log(res.text); // => 'নমস্কাৰ!'
```

`forceFrom` can be used in the same way.

## Proxy
Google Translate has request limits. If too many requests are made, you can either end up with a 429 or a 503 error.
You can use **proxy** to bypass them, however the default `requestFunction` of `fetch` does not support it:
```js
const tunnel = require('tunnel');
translate('Ik spreek Engels', {to: 'en'}, {
    agent: tunnel.httpsOverHttp({
    proxy: { 
      host: 'whateverhost',
      proxyAuth: 'user:pass',
      port: '8080',
      headers: {
        'User-Agent': 'Node'
      }
    }
  }
)}).then(res => {
    // do something
});
```

## Does it work from web page context?
It can, sort of. `https://translate.google.com` does not provide [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) http headers allowing access from other domains.  However, this fork is written using Fetch and/or Axios, allowing contexts that don't request CORS access, such as a browser extension background script or React Native.

## API

### translate(text, [options], [requestOptions])

#### input

Type: `string` | `string[]` | `{[key]: string}`

The text to be translated.

#### options

Type: `object`

##### from
Type: `string` Default: `auto`

The `text` language. Must be `auto` or one of the codes/names (not case sensitive) contained in [languages.js](https://github.com/vitalets/google-translate-api/blob/master/languages.js).

##### to
Type: `string` Default: `en`

The language in which the text should be translated. Must be one of the codes/names (case sensitive!) contained in [languages.js](https://github.com/vitalets/google-translate-api/blob/master/languages.js).

##### forceFrom
Type: `boolean` Default: `false`

Forces the translate function to use the `from` option as the iso code, without checking the languages list.

##### forceTo
Type: `boolean` Default: `false`

Forces the translate function to use the `to` option as the iso code, without checking the languages list.

##### raw
Type: `boolean` Default: `false`

If `true`, the returned object will have a `raw` property with the raw response (`string`) from Google Translate.

##### requestFunction
Type: `string|function` Default: `fetch|axios`

String inputs supported: `"fetch"` and `"axios"` for Fetch API and Axios respectively.

Function inputs should takes `(url, requestOptions, ?data)` and return the body of the request as a string.

Defaults to using fetch if available, axios if not.  And if neither are available and requestFunction is not defined as a function will error.

##### client
Type: `string` Default: `"t"`

Query parameter `client` used in API calls. Can be `t|gtx`.

##### tld
Type: `string` Default: `"com"`

TLD for Google translate host to be used in API calls: `https://translate.google.{tld}`.

#### requestOptions
Type: `object`

The options used by the requestFunction.  The [fetchinit](https://developer.mozilla.org/en-US/docs/Web/API/fetch) and [axiosconfig](https://axios-http.com/docs/req_config) are the default used.  requestOptions.headers is automatically converted to the `Header` class for fetchinit.

### Returns an `object` | `object[]` | `{[key]: object}`}:
Matches the structure of the input, so returns just the individual object if just a string is input, an array if an array is input, object with the same keys if an object is input.  Regardless of that, each returned value will have this schema:
- `text` *(string)* – The translated text.
- `from` *(object)*
  - `language` *(object)*
    - `didYouMean` *(boolean)* - `true` if the API suggest a correction in the source language
    - `iso` *(string)* - The [code of the language](https://github.com/vitalets/google-translate-api/blob/master/languages.js) that the API has recognized in the `text`
  - `text` *(object)*
    - `autoCorrected` *(boolean)* – `true` if the API has auto corrected the `text`
    - `value` *(string)* – The auto corrected `text` or the `text` with suggested corrections
    - `didYouMean` *(boolean)* – `true` if the API has suggested corrections to the `text`
- `raw` *(string)* - If `options.raw` is true, the raw response from Google Translate servers. Otherwise, `''`.

Note that `res.from.text` will only be returned if `from.text.autoCorrected` or `from.text.didYouMean` equals to `true`. In this case, it will have the corrections delimited with brackets (`[ ]`):

```js
translate('I spea Dutch').then(res => {
    console.log(res.from.text.value);
    //=> I [speak] Dutch
}).catch(err => {
    console.error(err);
});
```
Otherwise, it will be an empty `string` (`''`).

## Related projects
* [Translateer](https://github.com/Songkeys/Translateer) - uses Puppeteer to access Google Translate API.
* [google-translate-api-languages-script](https://github.com/AidanWelch/google-translate-api-languages-script) - a simple script used to scrape languages for this project.

## License

MIT © [Matheus Fernandes](http://matheus.top), forked and maintained by [Aidan Welch](https://github.com/AidanWelch).
