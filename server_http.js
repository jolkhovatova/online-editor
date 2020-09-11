const http = require('http');
const fs = require("fs");
const url = require('url');
const DiffMatchPatch = require('diff-match-patch');
const dmp = new DiffMatchPatch();
const {parse} = require('querystring');
const mysql = require("mysql2");
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    database: "oe",
    password: "1"
});

connection.connect(function (err) {
    if (err) {
        console.error("Ошибка: " + err.message);
        return console.error("Ошибка: " + err.message);
    } else {
        console.log("Подключение к серверу MySQL успешно установлено");
    }
});

let server = http.createServer(function (request, response) {
        if (request.method == 'GET') {
            // GET -> получить обработать
            let urlRequest = url.parse(request.url, true);
            let action = urlRequest.query.action;
            if (action === 'getDocument') {
                let documentId = urlRequest.query.documentId;
                let sql = "SELECT * FROM documents WHERE id=? ";
                let sqlParam = [documentId];
                connection.query(
                    sql,
                    sqlParam,
                    function (err, results) {
                        if (err) {
                        } else {
                            let document = results[0] || "";

                            response.writeHead(200, {"Content-Type": "application/json"});
                            response.end(JSON.stringify(document));
                        }
                    });
            } else {
                const filePath = request.url.substr(1) || "index.html";
                fs.access(
                    filePath,
                    fs.constants.R_OK,
                    err => {
                        if (err) {
                            response.statusCode = 404;
                            response.end("Resourse not found!");
                        } else {
                            fs.createReadStream(filePath).pipe(response);
                        }
                    });
            }

        } else {
            // POST
            let body = '';
            request.on('data', chunk => {
                body += chunk.toString();
            });
            request.on('end', () => {
                let params = parse(body);

                if (params.action == 'sendDiff') {
                    let sql = "INSERT INTO diffs(diff, document_id) VALUES (?, ?)";
                    let sqlParam = [params.diff, params.documentId];
                    connection.query(
                        sql,
                        sqlParam,
                        function (err, results) {
                            if (err) {
                            } else {
                                let insertedDiffId = parseInt(results.insertId);
                                let sql = "SELECT * FROM documents WHERE id=?";
                                let sqlParam = [params.documentId];
                                connection.query(
                                    sql,
                                    sqlParam,
                                    function (err, results) {
                                        if (!err) {
                                            let content = results[0].content || "";

                                            let patchDiff = dmp.patch_fromText(params.diff);
                                            let patchResult = dmp.patch_apply(patchDiff, content);
                                            if (patchResult[1][0] === true) {
                                                let patchContent = patchResult[0];
                                                let sql = "UPDATE documents SET content=?, last_diff_id=? WHERE id=?";
                                                let sqlParam = [patchContent, insertedDiffId, params.documentId];
                                                connection.query(
                                                    sql,
                                                    sqlParam,
                                                    function (err, results) {
                                                        if (!err) {
                                                            //  получить список дифов которые позже нашего (params.diffId)
                                                            let sql = "SELECT * FROM diffs WHERE document_id=? AND id>? ORDER BY id";
                                                            let sqlParam = [params.documentId, params.diffId];
                                                            connection.query(
                                                                sql,
                                                                sqlParam,
                                                                function (err, results) {
                                                                    if (!err) {
                                                                        let diffList = [];
                                                                        results.forEach(function (element) {
                                                                            diffList.push({
                                                                                diffId: element.id,
                                                                                diff: element.diff
                                                                            });
                                                                        });
                                                                        response.writeHead(200, {"Content-Type": "application/json"});
                                                                        response.end(JSON.stringify({
                                                                            noError: true,
                                                                            diffsList: diffList
                                                                        }));
                                                                    } else {
                                                                        console.log('err');
                                                                    }
                                                                }
                                                            );
                                                        } else {
                                                            console.log('update error', err);
                                                        }
                                                    }
                                                )
                                            }
                                        } else {
                                            console.log(err)
                                        }
                                    });

                            }

                        });

                }

                if (params.action == 'loadDiffs') {
                    //  получить список дифов которые позже нашего (params.diffId)
                    let sql = "SELECT * FROM diffs WHERE document_id=? AND id>? ORDER BY id";
                    let sqlParam = [params.documentId, params.diffId];
                    connection.query(
                        sql,
                        sqlParam,
                        function (err, results) {
                            if (!err) {
                                let diffList = [];
                                results.forEach(function (element) {
                                    diffList.push({diffId: element.id, diff: element.diff});
                                });
                                response.writeHead(200, {"Content-Type": "application/json"});
                                response.end(JSON.stringify({noError: true, diffsList: diffList}));
                            } else {
                                console.log('err');
                            }
                        }
                    );

                }
            });
        }
    }
);
server.listen(8080);
