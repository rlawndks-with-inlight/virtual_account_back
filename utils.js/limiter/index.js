import rateLimit from 'express-rate-limit';
import { getReqIp } from '../util.js';

const limiter = rateLimit({
    windowMs: 1000 * 60, //1초 ... 15 * 60 * 1000 15분
    max: 60,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        rate_limiter: 1
    },
    handler: function (req, res) {
        let ip = getReqIp(req);
        console.log(ip)
        res.status(429).send({
            rate_limiter: 1
        });
    }
});

export {
    limiter
}