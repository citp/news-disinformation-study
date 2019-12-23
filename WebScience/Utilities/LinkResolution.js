import { getDebuggingLog } from './Debugging.js';
const debugLog = getDebuggingLog("Studies.LinkExposure");


let promiseStore = new Map();
let trackLinks = new Map();
let links = new Map();

export function resolveURL(url) {
  var p = new Promise(function (resolve, reject) {
    // store this resolve object in the store
    let resolves = promiseStore[url] || [];
    resolves.push(resolve);
    promiseStore.set(url, resolves);
    // fetch this url
    fetch(url, { redirect: 'manual', headers: { 'User-Agent': '' } });
  });
  return p;
}

function getLocationFromResponseHeader(headers) {
  return headers.find(obj => {return obj.name == "location"; });
}

function responseHeaderListener(details) {
  // Continue only if this url is relevant for link resolution
  if(!trackLinks.has(details.url)) {
    return;
  }
  // get response header
  let loc = getLocationFromResponseHeader(details.responseHeaders);
  // if the response header contains a new url
  if (loc != null && (loc.value != details.url)) {
    let nexturl = loc.value;
    // Create a link between the next url and the initial url
    links.set(nexturl, details.url);
    // Add the next url so that we process it during the next onHeadersReceived
    trackLinks.set(nexturl, true);
    // Send fetch request to the next url
    fetch(nexturl, { redirect: 'manual', headers: { 'User-Agent': '' } });
  } else { // url is not redirected
    if (links.has(details.url)) {
      // backtrack links to get to the promise object that corresponds to this
      let url = details.url;
      while (links.has(url)) {
        url = links.get(url);
      }
      // url now contains the initial url. Now, resolve the corresponding promises
      if (url && promiseStore.has(url)) {
        let resolves = promiseStore.get(url) || [];
        let resolveObj = { source: url, dest: details.url };
        for (var i = 0; i < resolves.length; i++) {
          var r = resolves[i];
          r(resolveObj);
        }
        promiseStore.delete(url);
      }
    }
  }
}

browser.webRequest.onHeadersReceived.addListener(responseHeaderListener, {urls : ["<all_urls>"]}, ["responseHeaders"]);