var express = require("express");
var bodyParser = require("body-parser");
var path = require("path");
var XLSX = require("xlsx");
const https = require("https");
const cheerio = require('cheerio');
const { ZenRows } = require("zenrows");

var wb = XLSX.readFile("./responses.xlsx");
var sheetlist = wb.SheetNames;

Array.prototype.push_with_limit = function(element, limit) {
    var length = this.length;
    if (length == limit){
        this.shift();
    }
    this.push(element);
}

var URIdata = []
var oldURIdata = [];

var app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.json({ limit: "30MB", extended: true }));
app.use(bodyParser.urlencoded({ limit: "30MB", extended: true }));
app.engine("html", require("ejs").renderFile);
app.use(express.static(path.join(__dirname, "public")));

const client = new ZenRows("a4e060c71224638431902d7b25f89a4b5e30a1e9");


app.use("/", async (req, res) => {
    res.render("index", {
        data: URIdata
    });
});

const fetchDetails = async () => {
    try {
        URIdata = XLSX.utils.sheet_to_json(wb.Sheets[sheetlist[0]]);
        const promiseArr = [];

        for(let i=0; i<URIdata.length; i++) {
            promiseArr[i] = client.get(URIdata[i]["profile"], {});
        }

        const responses = await Promise.all(promiseArr);

        for(let i=0; i<URIdata.length; i++) {
            const $ = cheerio.load(responses[i].data);
            var points = $(".pb-information > li:nth-child(5)").html();

            if (points) {
                points = points.split("\n")[2].trim() ;
            } else {
                points = "0.00";
            }

            URIdata[i]["points"] = (parseFloat(parseFloat(points.replace(/,/g, '')) - parseFloat(URIdata[i]["pre_points"]))).toFixed(4);
        }

        URIdata.sort((a,b) => b.points - a.points);
        URIdata.forEach((obj, i) => obj.rank = i+1);

        if (oldURIdata.length > 0) {
            const oldData = oldURIdata[0];
            URIdata.forEach((obj, i) => {
                oldData.forEach((oldobj, oldi) => {
                    if (obj.roll == oldobj.roll && obj.points != oldobj.points) {
                        obj.change = (obj.points - oldobj.points).toFixed(2);
                    }
                });
            });
        }

        oldURIdata.push_with_limit(URIdata, 24);
    } catch (err) {
        console.log(err);
    }
}

fetchDetails();
// setInterval(fetchDetails, 1000 * 60*60);

exports = module.exports = app;

var port = process.env.PORT || 3000;
app.listen(port, function () {
    console.log("Server started at: http://localhost:" + String(port) + "/");
});
