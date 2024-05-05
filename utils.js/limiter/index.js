import rateLimit from 'express-rate-limit';
import { getReqIp } from '../util.js';

export const confirm_ip_list = [
    '::1',
    '0.0.0.0',
    '211.45.163.4',
    '127.0.0.1',
    '211.45.175.153',
    '54.79.149.16',
    '52.65.141.209',
    '54.252.21.217',
    '3.104.6.73',
    '18.219.207.193',
    '18.116.18.32',
    '3.133.218.23',
    '3.12.114.115',
]

const limiter = rateLimit({
    windowMs: 1000 * 60, //1초 ... 15 * 60 * 1000 15분
    max: 100,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        rate_limiter: 1
    },
    handler: function (req, res) {
        let ip = getReqIp(req);
        if (!confirm_ip_list.includes(ip)) {
            res.status(429).send({
                rate_limiter: 1
            });
        }
    }
});

export {
    limiter
}