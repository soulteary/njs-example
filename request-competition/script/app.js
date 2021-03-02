function chooseFast(r) {
  var n = 0;
  function done(res) {
    r.log(`res.parent: ${res.parent.uri}, res.uri: ${res.uri}`);
    if (++n == 1) {
      r.headersOut["Content-Type"] = "application/json";
      r.return(200, res.responseBody);
    }
  }

  r.subrequest("/slow", done);
  r.subrequest("/fast", done);
}

function slow(r) {
  setTimeout(() => {
    r.headersOut["Content-Type"] = "application/json";
    r.return(200, "mock slow response");
  }, 1000);
}

function fast(r) {
  r.headersOut["Content-Type"] = "application/json";
  r.return(200, "mock fast response");
}

export default { chooseFast, fast, slow };
