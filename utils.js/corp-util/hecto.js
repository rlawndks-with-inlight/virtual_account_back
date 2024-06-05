
import axios from 'axios';
import 'dotenv/config';
import crypto from 'crypto';
import https from 'https';
import { returnMoment } from '../function.js';

//const API_URL = process.env.API_ENV == 'production' ? "https://npay.settlebank.co.kr" : "https://tbnpay.settlebank.co.kr";
const API_URL = "https://tbnpay.settlebank.co.kr";
const GW_API_URL = process.env.NODE_ENV == 'production' ? "https://gw.settlebank.co.kr" : "https://tbgw.settlebank.co.kr"
const getDefaultHeader = () => {
    return {
        'Content-Type': 'application/json;charset=utf-8',
    }
}
const getDefaultBody = (dns_data, pay_type) => {
    let return_moment = returnMoment();
    let date = return_moment.split(' ')[0].replaceAll('-', '');
    let time = return_moment.split(' ')[1].replaceAll(':', '');
    return {
        'mchtId': dns_data?.auth_mcht_id,
        'reqDt': date,
        'reqTm': time,
    }
}
const getAES256 = (data, key) => {
    const cipher = crypto.createCipheriv('aes-256-ecb', key, null);

    // 데이터 업데이트 및 암호화
    let encryptedData = cipher.update(data, 'utf8', 'base64');
    encryptedData += cipher.final('base64');

    return encryptedData;
}
const decryptAES256 = (encryptedData, key) => {
    const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);

    // 암호화된 데이터 복호화
    let decryptedData = decipher.update(encryptedData, 'base64', 'utf8');
    decryptedData += decipher.final('utf8');

    return decryptedData;
}
const processObj = (obj_ = {}, hash_list = [], encr_list = [], dns_data) => {
    let obj = obj_;
    let pktHash = "";
    for (var i = 0; i < hash_list.length; i++) {
        pktHash += `${obj[hash_list[i]]}`;
    }
    pktHash += dns_data?.auth_api_id;
    const hash = crypto.createHash('sha256');
    hash.update(pktHash);
    const hashedData = hash.digest('hex');
    obj['pktHash'] = hashedData;

    for (var i = 0; i < encr_list.length; i++) {
        obj[encr_list[i]] = getAES256(`${obj[encr_list[i]]}`, dns_data?.auth_iv);
    }
    return obj;
}
const hexEncode = (str) => {
    // 문자열을 헥사 인코딩 값으로 변환
    return Buffer.from(str).toString('hex');
};
function processWithdrawObj(obj_ = {}, dns_data = {}, aes_list = []) {
    let obj = obj_;
    let keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
        if (aes_list.includes(keys[i])) {
            let key = dns_data?.withdraw_sign_key;
            obj[keys[i]] = getAES256(obj[keys[i]], key);
        }

    }
    return obj;
}
export const hectoApi = {
    balance: {
        info: async (data) => {//잔액
            try {
                let {
                    dns_data, pay_type, decode_user,
                    guid, amount,
                } = data;

                let query = {
                    mchtId: dns_data?.withdraw_mid,
                }
                query = processWithdrawObj(query);
                console.log(12321321321)
                let { data: response } = await axios.post(`${GW_API_URL}/pyag/v1/fxBalance`, new URLSearchParams(query).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        timeout: 30000 // 30초 타임아웃
                    });
                console.log(response)
                if (response?.outStatCd == '0021') {
                    return {
                        code: 100,
                        message: '',
                        data: {
                            amount: response?.blcKrw,
                        },
                    };
                } else {
                    return {
                        code: -100,
                        message: response?.outRsltMsg,
                        data: {},
                    };
                }

            } catch (err) {
                console.log(err)
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
                const bank_list = [
                    { value: '002', label: '산업은행', },
                    { value: '003', label: '기업은행', },
                    { value: '004', label: 'KB국민은행', },
                    { value: '007', label: '수협은행', },
                    { value: '011', label: 'NH농협은행', },
                    { value: '012', label: '농ㆍ축협', },
                    { value: '020', label: '우리은행', },
                    { value: '023', label: 'SC제일은행', },
                    { value: '027', label: '한국씨티은행', },
                    { value: '031', label: '대구은행', },
                    { value: '032', label: '부산은행', },
                    { value: '034', label: '광주은행', },
                    { value: '035', label: '제주은행', },
                    { value: '037', label: '전북은행', },
                    { value: '039', label: '경남은행', },
                    { value: '045', label: '새마을금고', },
                    { value: '048', label: '신협', },
                    { value: '050', label: '저축은행', },
                    { value: '052', label: '모건스탠리은행', },
                    { value: '054', label: 'HSBC은행', },
                    { value: '055', label: '도이치은행', },
                    { value: '071', label: '우체국', },
                    { value: '081', label: '하나은행', },
                    { value: '088', label: '신한은행', },
                    { value: '089', label: '케이뱅크', },
                    { value: '090', label: '카카오뱅크', },
                    { value: '092', label: '토스뱅크', },
                    { value: '209', label: '유안타증권', },
                    { value: '218', label: 'KB증권', },
                    { value: '238', label: '미래에셋대우', },
                    { value: '240', label: '삼성증권', },
                    { value: '243', label: '한국투자증권', },
                    { value: '247', label: 'NH투자증권', },
                    { value: '261', label: '교보증권', },
                    { value: '262', label: '하이투자증권', },
                    { value: '263', label: '현대차증권', },
                    { value: '264', label: '키움증권', },
                    { value: '265', label: '이베스트투자증권', },
                    { value: '266', label: 'SK증권', },
                    { value: '267', label: '대신증권', },
                    { value: '269', label: '한화투자증권', },
                    { value: '270', label: '하나금융증권', },
                    { value: '057', label: '제이피모간체이스은행', },
                    { value: '058', label: '미즈호은행', },
                    { value: '059', label: '엠유에프지은행', },
                    { value: '060', label: 'BOA은행', },
                    { value: '061', label: '비엔피파리바은행', },
                    { value: '062', label: '중국공상은행', },
                    { value: '063', label: '중국은행', },
                    { value: '064', label: '산림조합중앙회', },
                    { value: '065', label: '대화은행', },
                    { value: '066', label: '교통은행', },
                    { value: '067', label: '중국건설은행', },
                    { value: '278', label: '신한금융투자', },
                    { value: '279', label: 'DB금융투자', },
                    { value: '280', label: '유진투자증권', },
                    { value: '287', label: '메리츠증권', },
                    { value: '288', label: '카카오페이증권', },
                    { value: '290', label: '부국증권', },
                    { value: '291', label: '신영증권', },
                    { value: '292', label: '케이프투자증권', },
                    { value: '293', label: '한국증권금융', },
                    { value: '294', label: '한국포스증권', }
                ]
                let result = {
                    code: 100,
                    message: 'success',
                    data: bank_list
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
    withdraw: {
        request: async (data) => {//출금요청
            let {
                dns_data, pay_type, decode_user,
                bank_code, acct_num, amount, acct_name, trx_id
            } = data;
            try {

                let return_moment = returnMoment();

                let query = {
                    mchtId: dns_data?.withdraw_mid,
                    mchtTrdNo: trx_id,
                    encCd: '23',
                    trdDt: return_moment.split(' ')[0].replaceAll('-', ''),
                    trdTm: return_moment.split(' ')[1].replaceAll(':', ''),
                    bankCd: bank_code,
                    custAcntNo: acct_num,
                    custAcntSumry: acct_name,
                    amt: amount.toString(),
                }
                query = processWithdrawObj(query, dns_data, [
                    'custAcntNo',
                    'amt',
                ]);
                query['custAcntNo'] = encodeURI(query['custAcntNo']);
                query['amt'] = encodeURI(query['amt']);
                let { data: response } = await axios.post(`${GW_API_URL}/pyag/v1/fxTransKrw`, new URLSearchParams(query).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        timeout: 30000 // 30초 타임아웃
                    });
                console.log(response)
                if (response?.outStatCd == '0021') {
                    return {
                        code: 100,
                        message: '',
                        data: {
                            amount: response?.amt,
                            tid: response?.mchtTrdNo,
                            virtual_acct_balance: response?.balance,
                        },
                    };
                } else {
                    return {
                        code: -100,
                        message: response?.outRsltMsg,
                        data: {
                            tid: response?.mchtTrdNo,
                        },
                    };
                }
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {
                        tid: trx_id,
                    },
                };

            }
        },
        request_check: async (data) => {//출금요청
            let {
                dns_data, pay_type, decode_user,
                date, tid
            } = data;
            let mcht_trd_no = `OID${dns_data?.id}${new Date().getTime()}${decode_user?.id}${generateRandomString(5)}`;
            try {

                let query = {
                    mchtId: dns_data?.withdraw_mid,
                    mchtTrdNo: tid,
                    orgTrdDt: date,
                }
                query = processWithdrawObj(query, dns_data);
                console.log(query)

                let { data: response } = await axios.post(`${GW_API_URL}/pyag/v1/fxResult`, new URLSearchParams(query).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        timeout: 30000 // 30초 타임아웃
                    });
                if (response?.status == '99') {
                    response.status = 6;
                } else if (response?.status != '21') {
                    response.status = 3;
                } else {
                    response.status = 0;
                }
                if (response?.outStatCd == '0021') {
                    return {
                        code: 100,
                        message: '',
                        data: {
                            amount: response?.TRSC_AMT,
                            status: response?.status,
                        },
                    };
                } else {
                    return {
                        code: -100,
                        message: response?.outRsltMsg,
                        data: {
                            status: response?.status,
                        },
                    };
                }
            } catch (err) {
                console.log(err)
                console.log(err?.response?.data)
                return {
                    code: -100,
                    message: '',
                    data: {
                    },
                };

            }
        },
    }
}