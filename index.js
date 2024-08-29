'use strict';

import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import path from "path";
import 'dotenv/config';
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import http from 'http';
import https from 'https';
import scheduleIndex from "./utils.js/schedules/index.js";
import upload from "./config/multerConfig.js";
import { generateRandomString, getReqIp, imageFieldList } from "./utils.js/util.js";
import { fileURLToPath } from 'url';
import fs from 'fs';
import { uploadMultipleFiles } from "./utils.js/api-util.js";
import { confirm_ip_list, limiter } from "./utils.js/limiter/index.js";
import { pool } from "./config/db.js";
import { insertQuery } from "./utils.js/query-util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/files', express.static(__dirname + '/files'));
//app.post('/api/upload/multiple', upload.array('post_file'), uploadMultipleFiles);

app.use('/api', limiter);
app.use((req, res, next) => {
  // Check if request IP is in the whitelist
  let ip = getReqIp(req);
  if (confirm_ip_list.includes(ip)) {
    // Skip rate limiting for whitelisted IP addresses
    next();
  } else {
    // Continue with rate limiting for non-whitelisted IP addresses
    limiter(req, res, next);
  }
});
//app.use('/api', upload.fields(imageFieldList), routes);

app.get('/', (req, res) => {
  console.log("back-end initialized")
  res.send('back-end initialized')
});

app.use((req, res, next) => {
  console.log(req.originalUrl)
  console.log(req.method)
  const err = new APIError('API not found', httpStatus.NOT_FOUND);
  return next(err);
});
let server = undefined
const HTTP_PORT = 8001;
const HTTPS_PORT = 8443;


if (process.env.NODE_ENV == 'development') {
  server = http.createServer(app).listen(HTTP_PORT, function () {
    console.log("**-------------------------------------**");
    console.log(`====      Server is On ${HTTP_PORT}...!!!    ====`);
    console.log("**-------------------------------------**");
  });
} else {
  server = http.createServer(app).listen(HTTP_PORT, function () {
    console.log("**-------------------------------------**");
    console.log(`====      Server is On ${HTTP_PORT}...!!!    ====`);
    console.log("**-------------------------------------**");
    scheduleIndex();
  });
}
