'use strict';
import corpApi from "../utils.js/corp-util/index.js";
import { response } from "../utils.js/util.js";
import 'dotenv/config';

const corpUtilCtrl = {
    user: {
        info: async (req, res, next) => {//유저정보 출력
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.user.info({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },
        create: async (req, res, next) => {//유저정보 출력
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.user.create({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },
        remove: async (req, res, next) => {//출금계좌등록
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.user.remove({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },

        account_verify: async (req, res, next) => {//출금계좌등록
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.user.account_verify({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },
        account_delete: async (req, res, next) => {//출금계좌등록
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.user.account_delete({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },
        account: {
            info: async (req, res, next) => {//이체
                try {
                    let {
                        dns_data,
                        decode_user,
                        pay_type,
                    } = req.body;
                    if (!brand_id) {

                    }
                    let result = await corpApi.user.account.info({
                        ...req.body,
                        pay_type,
                        dns_data,
                        decode_user,
                    })
                    if (result.code == 100) {
                        return response(req, res, 100, "success", result.data);
                    } else {
                        return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                    }
                } catch (err) {
                    return response(req, res, -200, "서버 에러 발생", false)
                }
            },
            create: async (req, res, next) => {//출금계좌등록
                try {
                    let {
                        dns_data,
                        decode_user,
                        pay_type,
                    } = req.body;

                    let result = await corpApi.user.account.create({
                        ...req.body,
                        pay_type,
                        dns_data,
                        decode_user,
                    })
                    if (result.code == 100) {
                        return response(req, res, 100, "success", result.data);
                    } else {
                        return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                    }
                } catch (err) {
                    return response(req, res, -200, "서버 에러 발생", false)
                }
            },
        },
    },
    transfer: {
        pass: async (req, res, next) => {//이체
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.transfer.pass({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },
    },
    balance: {
        info: async (req, res, next) => {//유저정보 출력
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.balance.info({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },
    },
    bank: {
        list: async (req, res, next) => {//은행정보 출력
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.bank.list({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },
    },
    vaccount: async (req, res, next) => {//가상계좌발급
        try {
            let {
                dns_data,
                decode_user,
                pay_type,
            } = req.body;
            if (!brand_id) {

            }
            let result = await corpApi.vaccount({
                ...req.body,
                pay_type,
                dns_data,
                decode_user,
            })
            if (result.code == 100) {
                return response(req, res, 100, "success", result.data);
            } else {
                return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
            }
        } catch (err) {
            return response(req, res, -200, "서버 에러 발생", false)
        }
    },
    vaccount_delete: async (req, res, next) => {//가상계좌삭제
        try {
            let {
                dns_data,
                decode_user,
                pay_type,
            } = req.body;
            if (!brand_id) {

            }
            let result = await corpApi.vaccount_delete({
                ...req.body,
                pay_type,
                dns_data,
                decode_user,
            })
            if (result.code == 100) {
                return response(req, res, 100, "success", result.data);
            } else {
                return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
            }
        } catch (err) {
            return response(req, res, -200, "서버 에러 발생", false)
        }
    },
    push: {
        create: async (req, res, next) => {//푸시 url등록
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.push.create({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },
        update: async (req, res, next) => {//푸시 url등록
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.push.update({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },
    },
    mother: {
        to: async (req, res, next) => {//은행정보 출력
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.mother.to({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },
    },
    withdraw: {
        request: async (req, res, next) => {//출금요청
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.withdraw.request({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },
        request_check: async (req, res, next) => {//출금요청
            try {
                let {
                    dns_data,
                    decode_user,
                    pay_type,
                } = req.body;

                let result = await corpApi.withdraw.request_check({
                    ...req.body,
                    pay_type,
                    dns_data,
                    decode_user,
                })
                if (result.code == 100) {
                    return response(req, res, 100, "success", result.data);
                } else {
                    return response(req, res, -100, (result?.message || "서버 에러 발생"), result.data);
                }
            } catch (err) {
                return response(req, res, -200, "서버 에러 발생", false)
            }
        },
    },
};

export default corpUtilCtrl;
