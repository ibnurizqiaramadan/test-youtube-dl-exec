const express = require("express");
const _ = require("lodash");
const youtubedl = require("youtube-dl-exec");
const https = require("https");
const got = require("got");
const app = express();
const dotenv = require("dotenv");
const port = 3000;
dotenv.config();
const baseUrl = process.env.baseUrl;

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.get("/cek-url", async (req, res) => {
    youtubedl(req.query.url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
    })
        .then((output) => {
            if (req.query.type == "json") {
                res.send(output);
            } else {
                let filterEqui = output.formats.filter(
                    (x) => x.format_note.includes("equi") && x.ext === "mp4"
                );
                if (filterEqui.length == 0)
                    throw {
                        statusCode: 404,
                        message: "Equirectangular not Found",
                    };
                let findVideo = _.maxBy(filterEqui, (x) => x.width);
                const urll = Buffer.from(findVideo.url).toString("base64");
                res.send({
                    hasAudio: findVideo.audio_channels == null ? false : true,
                    // data: findVideo,
                    url: `${baseUrl}/play-video.mp4?url=${req.query.url}`,
                    "url-got": `${baseUrl}/test-got.mp4?url=${urll}&filesize=${findVideo.filesize}`,
                });
            }
        })
        .catch((err) => {
            res.status(err.statusCode ?? 500).send(err);
        });
});

app.get("/play-video.mp4", async (req, res) => {
    youtubedl(req.query.url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
    })
        .then((output) => {
            let filterEqui = output.formats.filter(
                (x) => x.format_note.includes("equi") && x.ext === "mp4"
            );
            let findVideo = _.maxBy(filterEqui, (x) => x.width);
            res.set("Accept-Ranges", "bytes");
            res.set("Content-Length", `${findVideo.filesize}`);
            res.set("Content-Type", "video/mp4");
            res.set("client-protocol", "quic");
            https.get(findVideo.url, (stream) => {
                stream.pipe(res);
            });
        })
        .catch((err) => {
            res.status(400).send(err);
        });
});

app.get("/test-got.mp4", async (req, res) => {
    const range = req.headers.range;
    const filesize = req.query.filesize;
    const urll = Buffer.from(req.query.url, "base64").toString("UTF-8");
    if (!range) {
        res.set("content-length", `${filesize}`);
        res.set("content-type", `video/mp4`);
        got.stream(urll).pipe(res);
        return;
    }
    const CHUNK_SIZE = 10 ** 6;
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = Math.min(start + CHUNK_SIZE, filesize - 1);
    const contentLength = end - start + 1;
    console.log(start, CHUNK_SIZE, end, filesize, contentLength);
    res.set("content-range", `bytes ${start}-${filesize - 1}/${filesize}`);
    res.set("accept-ranges", "bytes");
    res.set("content-length", `${CHUNK_SIZE}`);
    res.set("content-type", "video/mp4");
    got.stream(urll).pipe(res);
});

app.get("/play-video-test.mp4", async (req, res) => {
    youtubedl(req.query.url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
    })
        .then((output) => {
            let filterEqui = output.formats.filter(
                (x) => x.format_note.includes("equi") && x.ext === "mp4"
            );
            let findVideo = _.maxBy(filterEqui, (x) => x.height);
            const range = req.headers.range;
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1]
                    ? parseInt(parts[1], 10)
                    : findVideo.filesize - 1;
                const chunksize = end - start + 1;
                const filesize = findVideo.filesize;
                res.set("content-range", `bytes ${start}-${end}/${filesize}`);
                res.set("accept-ranges", "bytes");
                res.set("content-length", `${filesize}`);
                res.set("content-type", "video/mp4");
                https.get(findVideo.url, (stream) => {
                    stream.pipe(res);
                });
            } else {
                res.set("content-length", `${findVideo.filesize}`);
                res.set("content-type", "video/mp4");
                https.get(findVideo.url, (stream) => {
                    stream.pipe(res);
                });
            }
        })
        .catch((err) => {
            res.status(400).send(err);
        });
});

app.listen(port, "0.0.0.0", () => {
    console.log(`App listening on port ${port}`);
});
