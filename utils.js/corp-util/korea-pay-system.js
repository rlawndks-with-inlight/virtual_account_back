import axios from "axios";
import { returnMoment } from "../function.js";

const API_URL = `https://api.kp-pay.com`;

const makeHeaderData = (dns_data, pay_type) => {
    return {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `${dns_data[`${pay_type}_sign_key`]}`,
    }
}

const processBodyObj = (obj_ = {}, dns_data, pay_type, object_type = 'vact') => {
    let obj = obj_;
    obj = {
        ...obj,
        mchtId: dns_data[`${pay_type}_api_id`]
    }
    obj = {
        [object_type]: obj,
    }
    return obj;
}
const checkVirtualAccountGet = async (dns_data, pay_type) => {
    let first_query = {
        banks: [dns_data[`${pay_type}_virtual_bank_code`]],
    };
    first_query = processBodyObj(first_query, dns_data, pay_type);
    let virtual_issue_time = returnMoment();

    let { data: virtual_account_result } = await axios.post(`${API_URL}/api/vact/withdrawGet`, first_query, {
        headers: makeHeaderData(dns_data, pay_type)
    });
    if (virtual_account_result?.result?.resultCd != '0000') {
        return {
            code: -100,
            message: virtual_account_result?.result?.advanceMsg,
            data: {},
        };
    }
    let virtual_bank_code = virtual_account_result?.vact?.vacts[0]?.bankCd;
    let virtual_acct_num = virtual_account_result?.vact?.vacts[0]?.account;
    return {
        code: 100,
        message: '',
        data: {
            virtual_bank_code,
            virtual_acct_num,
            virtual_issue_time,
        },
    }
}
export const koreaPaySystemApi = {
    balance: {
        info: async (data) => {
            try {
                let { dns_data, pay_type, decode_user,
                    tid, vrf_word,
                } = data;
                let query = {
                    authNo: tid,
                    oneCertiInNo: vrf_word,
                }
                query = processBodyObj(query, dns_data, pay_type);
                let { data: result } = await axios.get(`${API_URL}/api/settle/balance`, {
                    headers: makeHeaderData(dns_data, pay_type)
                });
                if (result?.result?.resultCd != '0000') {
                    return {
                        code: -100,
                        message: result?.result?.advanceMsg,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: result?.message,
                    data: {
                        amount: result.balance?.balance,
                    },
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
    bank: {
        list: async (data) => {
            try {
                let { dns_data, pay_type, decode_user, guid } = data;
                const bank_list = [
                    { value: '002', label: '한국산업은행', },
                    { value: '003', label: '중소기업은행', },
                    { value: '004', label: '국민은행', },
                    { value: '007', label: '수협은행', },
                    { value: '011', label: '농협(중앙회)', },
                    { value: '012', label: '농협(지역)', },
                    { value: '020', label: '우리은행', },
                    { value: '023', label: 'SC은행', },
                    { value: '027', label: '한국씨티은행', },
                    { value: '031', label: '대구은행', },
                    { value: '032', label: '부산은행', },
                    { value: '034', label: '광주은행', },
                    { value: '035', label: '제주은행', },
                    { value: '037', label: '전북은행', },
                    { value: '039', label: '경남은행', },
                    { value: '045', label: '새마을금고', },
                    { value: '048', label: '신협', },
                    { value: '050', label: '상호저축은행', },
                    { value: '051', label: '기타외국은행', },
                    { value: '052', label: '모간스탠리', },
                    { value: '054', label: '홍콩상하이은행', },
                    { value: '055', label: '도이치은행', },
                    { value: '056', label: '에이비엔암로은행', },
                    { value: '058', label: '미즈호코퍼레이트은행', },
                    { value: '059', label: '도쿄미쓰비시은행', },
                    { value: '060', label: '뱅크오브아메리카', },
                    { value: '064', label: '산림조합', },
                    { value: '071', label: '우체국', },
                    { value: '081', label: 'KEB하나은행', },
                    { value: '088', label: '신한은행', },
                    { value: '089', label: '케이뱅크', },
                    { value: '090', label: '카카오뱅크', },
                    { value: '092', label: '토스뱅크', },
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
    vaccount_delete: async (data) => {
        try {
            let { dns_data, pay_type, decode_user,
                virtual_acct_num,
                phone_num,
                bank_code,
                acct_num,
                name,
            } = data;

            let query = {
                trxType: '1',
                account: virtual_acct_num,
                withdrawBankCd: bank_code,
                withdrawAccount: acct_num,
                phoneNo: phone_num,
                name,
                holderName: name,
            }
            query = processBodyObj(query, dns_data, pay_type, "vact");
            console.log(query)
            let { data: result } = await axios.post(`${API_URL}/api/vact/reg`, query, {
                headers: makeHeaderData(dns_data, pay_type)
            });
            console.log(result);
            if (result?.result?.resultCd != '0000') {
                return {
                    code: -100,
                    message: result?.result?.advanceMsg,
                    data: {},
                };
            }
            return {
                code: 100,
                message: result?.message,
                data: {
                    tid: result?.vact?.issueId,
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
    account: {
        info: async (data) => {//예금주명조회
            try {
                let { dns_data, pay_type, decode_user,
                    bank_code, acct_num, birth, business_num, user_type
                } = data;
                let query = {
                    account: acct_num,
                    bankCd: bank_code,
                    identity: user_type == 0 ? birth : business_num,
                }
                query = processBodyObj(query, dns_data, pay_type, "accnt");
                let { data: result } = await axios.post(`${API_URL}/api/settle/accnt`, query, {
                    headers: makeHeaderData(dns_data, pay_type)
                });
                if (result?.result?.resultCd != '0000') {
                    return {
                        code: -100,
                        message: result?.result?.advanceMsg,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: result?.message,
                    data: {
                        withdraw_acct_name: result?.accnt?.holder,
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
    vaccount_get: async (data) => {
        let { dns_data, pay_type, decode_user,
            email, name, phone_num, birth, guid,
            virtual_bank_code, virtual_acct_num, virtual_issue_time,
        } = data;
        let ci = `${new Date().getTime()}` + phone_num + birth;
        try {
            //발급 가능한 가상계좌 확인
            let new_virtual_account = await checkVirtualAccountGet(dns_data, pay_type);
            if (new_virtual_account?.code < 0) {
                return {
                    code: -100,
                    message: new_virtual_account.message,
                    data: {

                    },
                };
            }
            virtual_bank_code = new_virtual_account.data?.virtual_bank_code;
            virtual_acct_num = new_virtual_account.data?.virtual_acct_num;
            virtual_issue_time = new_virtual_account.data?.virtual_issue_time;
            return {
                code: 100,
                message: '',
                data: {
                    virtual_bank_code,
                    virtual_acct_num,
                    virtual_issue_time,
                },
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
    withdraw: {
        request: async (data) => {//출금신청
            try {
                let { dns_data, pay_type, decode_user,
                    guid, amount,
                    bank_code,
                    acct_num,
                    acct_name,
                } = data;

                let query = {
                    amount: amount,
                    trackId: `${dns_data?.id ?? 0}-${decode_user?.id ?? 0}-${new Date().getTime()}`,
                    bankCd: bank_code,
                    account: acct_num,
                    recordInfo: acct_name,
                }
                query = processBodyObj(query, dns_data, pay_type, "transfer");
                console.log(query)

                let { data: result } = await axios.post(`${API_URL}/api/settle/transfer`, query, {
                    headers: makeHeaderData(dns_data, pay_type)
                });
                console.log(result)
                if (result?.result?.resultCd != '0000') {
                    return {
                        code: -100,
                        message: result?.result?.advanceMsg,
                        data: {},
                    };
                }
                return {
                    code: 100,
                    message: result?.message,
                    data: {
                        tid: result?.transfer?.trxId,
                        top_amount: result?.transfer?.fee,
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
}