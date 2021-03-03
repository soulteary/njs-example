var fs = require("fs");

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

function getFilePath(req, subject) {
  var path = `/etc/nginx/data/${subject}.json`;
  try {
    fs.accessSync(path, fs.constants.R_OK);
    return path;
  } catch (error) {
    req.error(`Failed to access ${path}: ${error.message}`);
    req.return(500, `Failed to access ${path}: ${error.message}`);
    return;
  }
}

function contentOf(req, subject) {
  var path = getFilePath(req, subject);
  if (!path) {
    var rlt = `No subject '${subject}' found.`;
    req.error(rlt);
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (error) {
    req.error(`Read content of ${path} failed.`);
    req.return(500, `Read content of ${path} failed.`);
    return;
  }
}

function updateContent(req, subject, name, data) {
  var content = contentOf(req, subject);
  content[name] = data;
  var path = getFilePath(req, subject);
  fs.writeFileSync(path, JSON.stringify(content), "utf8");
  req.log(`written to file ${subject}`);
}

function removeContent(req, subject, name) {
  var content = contentOf(req, subject);
  delete content[name];
  var path = getFilePath(req, subject);
  fs.writeFileSync(path, JSON.stringify(content), "utf8");
  req.log(`written to file ${subject}`);
}

function get(req, res) {
  var subjects = getSubjects(req, res);
  var result = {};

  subjects.forEach(function (subject) {
    var content = contentOf(req, subject);
    if (!content) {
      req.return(500, `cannot get details of ${subject}.`);
      return;
    }
    Object.keys(content).forEach((label) => {
      if (!result[label]) result[label] = {};
      result[label][subject] = content[label];
    });
  });

  req.headersOut["Content-Type"] = "application/json";
  req.return(200, JSON.stringify(result));
  return;
}

function post(req, res) {
  var subjects = getSubjects(req, res);
  var updSubjects = {};

  try {
    updSubjects = JSON.parse(req.requestBody);
  } catch (error) {
    req.error(`Failed to parse request body: ${req.requestBody}: ${error.message}`);
    req.return(400, error.message);
    return;
  }

  Object.keys(updSubjects).forEach((subject) => {
    var content = updSubjects[subject];
    Object.keys(content).forEach((label) => {
      if (subjects.indexOf(label) === -1) {
        req.return(400, `${label} not supported`);
        return;
      }
      updateContent(req, label, subject, updSubjects[subject][label]);
    });
  });

  req.return(201, req.requestBody);
  return;
}

function remove(req, res) {
  var subjects = getSubjects(req, res);
  var delSubjects = {};

  try {
    delSubjects = JSON.parse(req.requestBody);
  } catch (error) {
    req.error(`Failed to parse request body: ${req.requestBody}: ${error.message}`);
    req.return(400, error.message);
    return;
  }

  subjects.forEach((subject) => {
    removeContent(req, subject, delSubjects.name);
  });
  req.return(201, req.requestBody);
  return;
}

function bookinfo(req) {
  switch (req.method.toUpperCase()) {
    case "GET":
      return req.subrequest("/subjects/", (res) => get(req, res));
    case "POST":
      return req.subrequest("/subjects/", (res) => post(req, res));
    case "DELETE":
      return req.subrequest("/subjects/", (res) => remove(req, res));
    default:
      req.return(501, `Not Implemented.`);
      break;
  }
}

export default { bookinfo };
