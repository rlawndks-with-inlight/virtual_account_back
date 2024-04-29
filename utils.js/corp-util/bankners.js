import axios from 'axios';
import 'dotenv/config';
import crypto from 'crypto';
import https from 'https';

const API_URL = process.env.NODE_ENV == 'production' ? "api.bankners.com" : "stgapi.bankners.com";

const makeHeaderData = (dns_data, pay_type, decode_user) => {
    let cur_time = new Date().getTime();
    let req_uniq_no = `${cur_time}${dns_data?.id}${decode_user?.id}`;
    let api_sign_val = crypto.createHash('sha256').update(`${dns_data[`${pay_type}_api_id`]}${req_uniq_no}${dns_data[`${pay_type}_sign_key`]}`).digest('hex');
    return {
        'Content-Type': 'application/json',
        'api_id': dns_data[`${pay_type}_api_id`],
        'api_sign_val': api_sign_val,
        'req_uniq_no': req_uniq_no,
    }
}
function encryptAES256(text, ENCR_KEY, IV) {
    let encr_key = Buffer.from(ENCR_KEY, 'hex');
    let iv = Buffer.from(IV, 'hex');
    let cipher = crypto.createCipheriv('aes-256-cbc', encr_key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    encrypted = encrypted.toString('hex').replace(/^"|"$/g, '');

    return encrypted;
}

function decryptAES256(encryptedText, ENCR_KEY, IV) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCR_KEY, 'hex'), Buffer.from(IV, 'hex'));
    let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
}
const makeBody = (query_, dns_data, pay_type) => {
    let query = query_;
    const encryptedRequestBody = encryptAES256(JSON.stringify(query), dns_data[`${pay_type}_encr_key`], dns_data[`${pay_type}_iv`]);
    return encryptedRequestBody;
}

const postRequest = async (uri, query, headers_data, method = 'POST') => {
    const options = {
        hostname: API_URL,
        port: 443, // SSL 포트 443
        path: uri,
        method: method,
        headers: {
            ...headers_data,
            'Content-Length': Buffer.byteLength(query)
        }
    };
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve(JSON.parse(data));
            });
        });

        req.on('error', (e) => {
            console.log(e)
            reject(`Error: ${e.message}`);
        });

        req.write(query);
        req.end();
    });
}


export const banknersApi = {
    user: {
        info: async (data) => {
            try {
                let { dns_data, pay_type, decode_user, guid } = data;
                let query = {
                    guid: guid
                }
                query = new URLSearchParams(query).toString();
                let { data: result } = await axios.get(`https://${API_URL}/api/user/info?${query}`, {
                    headers: makeHeaderData(dns_data, pay_type, decode_user)
                })
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                result.data = decryptAES256(result.data, dns_data[`${pay_type}_encr_key`], dns_data[`${pay_type}_iv`])
                result.data = JSON.parse(result.data);
                return {
                    code: 100,
                    message: result?.message,
                    data: result.data,
                };
            } catch (err) {
                console.log(err);
                return {
                    code: -100,
                    message: result?.message,
                    data: {},
                };
            }
        },
        create: async (data) => {
            try {
                let {
                    dns_data, pay_type, decode_user,
                    email, name, phone_num, birth,
                } = data;
                let query = {
                    mem_nm: name,
                    mem_email: email,
                    sms_recv_cp: phone_num,
                    birth_ymd: birth,
                    ci: `${new Date().getTime()}` + phone_num + birth,
                    user_tp: 'PERSON',
                    auth_tp: 'PASS',
                }
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/user', query, makeHeaderData(dns_data, pay_type, decode_user));
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: '',
                    data: {
                        guid: result?.data?.user_guid,
                        uniq_no: result?.data?.req_uniq_no,
                    },
                };
            } catch (err) {
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
        remove: async (data) => {
            try {
                let {
                    dns_data, pay_type, decode_user,
                    guid,
                } = data;
                let query = {
                    guid,
                }
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/user/remove', query, makeHeaderData(dns_data, pay_type, decode_user), 'DELETE');
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                console.log(result)
                return {
                    code: 100,
                    message: '',
                    data: {
                    },
                };
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
        account: async (data) => {
            try {
                let {
                    dns_data, pay_type, decode_user,
                    deposit_bank_code, deposit_acct_num, deposit_acct_name, guid,
                    birth
                } = data;
                let query = {
                    guid: guid,
                    bank_id: deposit_bank_code,
                    acnt_no: deposit_acct_num,
                    real_auth_no: birth,
                    acnt_holder: deposit_acct_name
                }
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/user/account', query, makeHeaderData(dns_data, pay_type, decode_user));
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: '',
                    data: {
                        tid: result?.data?.tid,
                        uniq_no: result?.data?.req_uniq_no,
                    },
                };
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
        account_verify: async (data) => {
            try {
                let {
                    dns_data, pay_type, decode_user,
                    tid, vrf_word,
                } = data;
                let query = {
                    tid: tid,
                    vrf_word: vrf_word,
                }
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/user/account/verify', query, makeHeaderData(dns_data, pay_type, decode_user));
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: '',
                    data: {
                        tid: result?.data?.tid,
                        uniq_no: result?.data?.req_uniq_no,
                    },
                };
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
        account_delete: async (data) => {
            try {
                let {
                    dns_data, pay_type, decode_user,
                    guid, bank_id, deposit_acct_num
                } = data;
                let query = {
                    guid,
                    bank_id: bank_id,
                    acnt_no: deposit_acct_num,
                }
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/user/account', query, makeHeaderData(dns_data, pay_type, decode_user), 'DELETE');
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: '',
                    data: {
                        bank_id: dns_data[`${pay_type}_virtual_bank_code`],
                        virtual_acct_num: result?.data?.vacnt_no,
                        tid: result?.data?.tid,
                        virtual_acct_name: result?.data?.vacnt_nm,
                    },
                };
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
    },
    transfer: {
        pass: async (data) => {//이체
            try {
                let {
                    dns_data, pay_type, decode_user,
                    from_guid, to_guid,
                    amount,
                } = data;
                let query = {
                    from_guid: from_guid,
                    to_guid: to_guid,
                    trx_amt: amount,
                    trx_curr: 'KRW'
                }
                console.log(query)
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/transfer/auth/pass', query, makeHeaderData(dns_data, pay_type, decode_user));
                console.log(result)
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: '',
                    data: {
                        tid: result?.data?.tid,
                        uniq_no: result?.data?.req_uniq_no,
                    },
                };
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
    },
    balance: {
        info: async (data) => {
            try {
                let { dns_data, pay_type, decode_user, guid, curr } = data;
                let query = {
                    guid: guid,
                    curr: 'KRW',
                }
                query = new URLSearchParams(query).toString();
                let { data: result } = await axios.get(`https://${API_URL}/api/balance/info?${query}`, {
                    headers: makeHeaderData(dns_data, pay_type, decode_user)
                })
                console.log(result)
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: result?.message,
                    data: {
                        guid: result.data?.guid,
                        amount: result.data?.bal_tot_amt,
                    },
                };
            } catch (err) {
                console.log(err?.response?.data);
                return {
                    code: -100,
                    message: '',
                    data: {},
                };
            }
        },
    },
    bank: {
        list: async (data) => {
            try {
                let { dns_data, pay_type, decode_user, guid } = data;

                let query = {
                    guid: guid
                }
                /*
                query = new URLSearchParams(query).toString();
                let { data: response } = await axios.get(`https://${API_URL}/api/bank/list`, {
                    headers: makeHeaderData(dns_data, 'deposit', decode_user)
                })
                console.log(response)
                if (response?.code != '0000') {
                    return {
                        code: -100,
                        message: response?.message,
                        data: {},
                    };
                }
                */
                const bank_list = [
                    {
                        bank_id: '039',
                        bank_nm: '경남은행',
                        bank_en_nm: 'Kyongnam Bank',
                        swift_cd: 'KYNAKR22'
                    },
                    {
                        bank_id: '003',
                        bank_nm: 'IBK기업은행',
                        bank_en_nm: '',
                        swift_cd: 'IBKOKRSE'
                    },
                    {
                        bank_id: '088',
                        bank_nm: '신한은행',
                        bank_en_nm: 'SHINHAN BANK',
                        swift_cd: 'SHBKKRSE'
                    },
                    {
                        bank_id: '004',
                        bank_nm: 'KB국민은행',
                        bank_en_nm: '',
                        swift_cd: 'CZNBKRSE'
                    },
                    {
                        bank_id: '081',
                        bank_nm: 'KEB하나은행',
                        bank_en_nm: 'KEB Hana Bank',
                        swift_cd: 'KOEXKRSE'
                    },
                    {
                        bank_id: '090',
                        bank_nm: '카카오뱅크',
                        bank_en_nm: 'KAKAO BANK',
                        swift_cd: 'CITIKRSXKA'
                    },
                    {
                        bank_id: '089',
                        bank_nm: '케이뱅크',
                        bank_en_nm: 'K BANK',
                        swift_cd: ''
                    },
                    {
                        bank_id: '071',
                        bank_nm: '우체국',
                        bank_en_nm: '',
                        swift_cd: 'SHBKKRSEKP'
                    },
                    {
                        bank_id: '007',
                        bank_nm: 'Sh수협은행',
                        bank_en_nm: '',
                        swift_cd: 'NFFCKRSE'
                    },
                    {
                        bank_id: '020',
                        bank_nm: '우리은행',
                        bank_en_nm: '',
                        swift_cd: 'HVBKKRSE'
                    },
                    {
                        bank_id: '011',
                        bank_nm: 'NH농협은행',
                        bank_en_nm: '',
                        swift_cd: 'NACFKRSE'
                    },
                    {
                        bank_id: '012',
                        bank_nm: '지역농축협',
                        bank_en_nm: '',
                        swift_cd: ''
                    },
                    {
                        bank_id: '048',
                        bank_nm: '신협은행',
                        bank_en_nm: 'Credit Union',
                        swift_cd: ''
                    },
                    {
                        bank_id: '045',
                        bank_nm: '새마을금고',
                        bank_en_nm: 'Korea Federation of Community Credit Cooperative.',
                        swift_cd: ''
                    },
                    {
                        bank_id: '034',
                        bank_nm: '광주은행',
                        bank_en_nm: 'Kwangju Bank',
                        swift_cd: 'KWABKRSE'
                    },
                    {
                        bank_id: '037',
                        bank_nm: '전북은행',
                        bank_en_nm: 'Jeonbuk Bank',
                        swift_cd: 'JEONKRSE'
                    },
                    {
                        bank_id: '031',
                        bank_nm: '대구은행',
                        bank_en_nm: 'Daegu Bank',
                        swift_cd: 'DAEBKR22'
                    },
                    {
                        bank_id: '032',
                        bank_nm: '부산은행',
                        bank_en_nm: 'Busan Bank',
                        swift_cd: 'PUSBKR2P'
                    },
                    {
                        bank_id: '092',
                        bank_nm: '토스뱅크',
                        bank_en_nm: 'TOSS Bank',
                        swift_cd: ''
                    },
                    {
                        bank_id: '035',
                        bank_nm: '제주은행',
                        bank_en_nm: 'Jeju Bank',
                        swift_cd: 'JJBKKR22'
                    },
                ]
                let result = {
                    code: 100,
                    message: 'success',
                    data: bank_list
                }

                for (var i = 0; i < result.data.length; i++) {
                    result.data[i].label = result.data[i]?.bank_nm;
                    result.data[i].value = result.data[i]?.bank_id;
                }
                return {
                    code: 100,
                    message: result?.message,
                    data: result.data,
                };
            } catch (err) {
                console.log(err);
                return {
                    code: -100,
                    message: '',
                    data: {},
                };
            }
        },
    },
    vaccount: async (data) => {
        try {
            let {
                dns_data, pay_type, decode_user,
                guid
            } = data;
            let query = {
                guid,
                bank_id: dns_data[`${pay_type}_virtual_bank_code`],
                version: 2,
            }
            query = makeBody(query, dns_data, pay_type)
            let result = await postRequest('/api/vaccount', query, makeHeaderData(dns_data, pay_type, decode_user));
            if (result?.code != '0000') {
                return {
                    code: -100,
                    message: result?.message,
                    data: {},
                };
            }
            return {
                code: 100,
                message: '',
                data: {
                    bank_id: dns_data[`${pay_type}_virtual_bank_code`],
                    virtual_acct_num: result?.data?.vacnt_no,
                    tid: result?.data?.tid,
                    virtual_acct_name: result?.data?.vacnt_nm,
                },
            };
        } catch (err) {
            console.log(err)
            console.log(err?.response?.data)
            return {
                code: -100,
                message: '',
                data: {},
            };

        }
    },
    vaccount_info: async (data) => {
        try {
            let { dns_data, pay_type, decode_user, guid, curr } = data;
            let query = {
                guid: guid,
            }
            query = new URLSearchParams(query).toString();
            let { data: result } = await axios.get(`https://${API_URL}/api/vaccount/info?${query}`, {
                headers: makeHeaderData(dns_data, pay_type, decode_user)
            })
            console.log(result)
            if (result?.code != '0000') {
                return {
                    code: -100,
                    message: result?.message,
                    data: {},
                };
            }
            let status = result?.data?.use_stat == 'USE' ? 0 : 1;
            return {
                code: 100,
                message: '',
                data: {
                    virtual_acct_num: result?.data?.vacnt_no,
                    status: status,
                },
            };
        } catch (err) {
            console.log(err)
            console.log(err?.response?.data)
            return {
                code: -100,
                message: '',
                data: {},
            };

        }
    },
    vaccount_delete: async (data) => {
        try {
            let {
                dns_data, pay_type, decode_user,
                guid, bank_id, virtual_acct_num
            } = data;
            let query = {
                guid,
                bank_id: bank_id,
                vacnt_no: virtual_acct_num,
            }
            query = makeBody(query, dns_data, pay_type)
            let result = await postRequest('/api/vaccount', query, makeHeaderData(dns_data, pay_type, decode_user), 'DELETE');
            if (result?.code != '0000') {
                return {
                    code: -100,
                    message: result?.message,
                    data: {},
                };
            }
            return {
                code: 100,
                message: '',
                data: {
                    bank_id: dns_data[`${pay_type}_virtual_bank_code`],
                    virtual_acct_num: result?.data?.vacnt_no,
                    tid: result?.data?.tid,
                    virtual_acct_name: result?.data?.vacnt_nm,
                },
            };
        } catch (err) {
            console.log(err)
            console.log(err?.response?.data)
            return {
                code: -100,
                message: '',
                data: {},
            };

        }
    },
    push: {
        create: async (data) => {//푸시 url등록
            try {
                let {
                    dns_data, pay_type, decode_user,
                    push_kind, push_tp, push_url, encr_yn
                } = data;
                let query = {
                    push_kind,
                    push_tp,
                    push_url,
                    encr_yn,
                }
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/merchant/push', query, makeHeaderData(dns_data, pay_type, decode_user));
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: '',
                    data: {},
                };
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
        update: async (data) => {//푸시 url등록
            try {
                let {
                    dns_data, pay_type, decode_user,
                    push_kind, push_tp, push_url, encr_yn
                } = data;
                let query = {
                    push_kind,
                    push_tp,
                    push_url,
                    encr_yn,
                }
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/merchant/push', query, makeHeaderData(dns_data, pay_type, decode_user), 'PUT');
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: '',
                    data: {},
                };
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
    },
    mother: {
        to: async (data) => {//은행정보 출력
            try {
                let {
                    dns_data, pay_type, decode_user,
                    amount, guid
                } = data;
                let query = {
                    from_guid: guid,
                    to_guid: dns_data[`${pay_type}_guid`],
                    trx_amt: amount,
                    trx_curr: 'KRW',
                }
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/pay/auth/pass', query, makeHeaderData(dns_data, pay_type, decode_user));
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: '',
                    data: {},
                };
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
    },
    withdraw: {
        request: async (data) => {//출금요청
            try {
                let {
                    dns_data, pay_type, decode_user,
                    guid, amount,
                } = data;
                let query = {
                    guid: guid,
                    trx_amt: amount,
                    trx_curr: 'KRW'
                }
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/user/withdraw/auth/pass', query, makeHeaderData(dns_data, pay_type, decode_user));
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: '',
                    data: {
                        tid: result?.data?.tid,
                        uniq_no: result?.data?.req_uniq_no,
                    },
                };
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
    },
    bl: {
        create: async (data) => {//블랙리스트등록
            try {
                let {
                    dns_data, pay_type, decode_user,
                    type = 0,
                    word
                } = data;
                if (type == 0) {
                    type = 'ACCOUNT';
                } else if (type == 1) {
                    type = 'CP';
                }
                let query = {
                    bl_tp: type,
                    bl_word: word,
                }
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/merchant/bl', query, makeHeaderData(dns_data, pay_type, decode_user));
                console.log(result)
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: '',
                    data: {

                    },
                };
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
        remove: async (data) => {//블랙리스트등록
            try {
                let {
                    dns_data, pay_type, decode_user,
                    type = 0,
                    word
                } = data;
                if (type == 0) {
                    type = 'ACCOUNT';
                } else if (type == 1) {
                    type = 'CP';
                }
                let query = {
                    bl_tp: type,
                    bl_word: word,
                }
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/merchant/bl', query, makeHeaderData(dns_data, pay_type, decode_user), 'DELETE');
                console.log(result)
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: '',
                    data: {

                    },
                };
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
    },
    pay: {
        cancel: async (data) => {//거래취소
            try {
                let {
                    dns_data, pay_type, decode_user,
                    tid,
                    from_guid, to_guid,
                    amount,
                } = data;
                if (type == 0) {
                    type = 'ACCOUNT';
                } else if (type == 1) {
                    type = 'CP';
                }
                let query = {
                    tid: tid,
                    from_guid: from_guid,
                    to_guid: to_guid,
                    cncl_amt: amount
                }
                query = makeBody(query, dns_data, pay_type)
                let result = await postRequest('/api/pay/cancel', query, makeHeaderData(dns_data, pay_type, decode_user));
                console.log(result)
                if (result?.code != '0000') {
                    return {
                        code: -100,
                        message: result?.message,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: '',
                    data: {
                        tid: result?.data?.tid,
                    },
                };
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {},
                };

            }
        },
    }
}
