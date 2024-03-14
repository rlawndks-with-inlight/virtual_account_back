import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
    windowMs: 1000 * 60, //1초 ... 15 * 60 * 1000 15분
    max: 60,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        rate_limiter: 1
    },
    handler: function (req, res) {
        res.status(429).send('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    }
});

export {
    limiter
}