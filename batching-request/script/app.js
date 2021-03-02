// https://github.com/nginx/njs/issues/352#issuecomment-721126632
function resolveAll(promises) {
  return new Promise((resolve, reject) => {
    var n = promises.length;
    var rs = Array(n);
    var done = () => {
      if (--n === 0) {
        resolve(rs);
      }
    };
    promises.forEach((p, i) => {
      p.then((x) => {
        rs[i] = x;
      }, reject).then(done);
    });
  });
}

function getSubjects(req, res) {
  if (res.status !== 200) {
    req.error(`Request to ${res.uri} failed.`);
    req.return(res.status, res.responseBody);
    return [];
  }
  try {
    var subjects = JSON.parse(res.responseBody);
    return subjects.filter((file) => file.size > 0).map((file) => file.name.substr(0, file.name.indexOf(".json")));
  } catch (error) {
    req.error(`Parse ${res.uri} failed.`);
    req.return(500, res.responseBody);
    return [];
  }
}

function batching(req) {
  req
    .subrequest("/subjects/")
    .then((res) => getSubjects(req, res))
    .then((subjects) => resolveAll(subjects.map((subject) => req.subrequest(`/subjects/${subject}.json`))))
    .then((subjects) => {
      var result = subjects.reduce((prev, subject) => {
        var uri = subject.uri;
        var prop = uri.substr(uri.lastIndexOf("/") + 1, uri.lastIndexOf(".json") - uri.lastIndexOf("/") - 1);
        try {
          var data = JSON.parse(subject.responseText);
          Object.keys(data).forEach((label) => {
            prev[label] = prev[label] || {};
            prev[label][prop] = data[label];
          });
        } catch (err) {
          req.error(`Parse ${uri} failed.`);
        }
        return prev;
      }, {});
      req.headersOut["Content-Type"] = "application/json";
      req.return(200, JSON.stringify(result));
    })
    .catch((e) => req.return(501, e.message));
}

export default { batching };
