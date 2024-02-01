
import axios from 'axios';
import 'dotenv/config';
import crypto from 'crypto';
import https from 'https';


export const doznApi = {
    bank: {
        list: async (data) => {
            try {
                let { dns_data, pay_type, decode_user, guid } = data;
                const bank_list = [
                    { value: '001', label: '한국은행' },
                    { value: '002', label: '산업은행' },
                    { value: '003', label: '기업은행' },
                    { value: '004', label: '국민은행' },
                    { value: '007', label: '수협은행' },
                    { value: '008', label: '수출입은행' },
                    { value: '011', label: 'NH농협은행' },
                    { value: '012', label: '농축협' },
                    { value: '020', label: '우리은행' },
                    { value: '023', label: 'SC제일은행' },
                    { value: '027', label: '한국씨티은행' },
                    { value: '031', label: '대구은행' },
                    { value: '032', label: '부산은행' },
                    { value: '034', label: '광주은행' },
                    { value: '035', label: '제주은행' },
                    { value: '037', label: '전북은행' },
                    { value: '039', label: '경남은행' },
                    { value: '041', label: '우리카드' },
                    { value: '045', label: '새마을금고' },
                    { value: '048', label: '신협' },
                    { value: '050', label: '저축은행' },
                    { value: '052', label: '모간스탠리은행' },
                    { value: '054', label: 'HSBC은행' },
                    { value: '055', label: '도이치은행' },
                    { value: '057', label: '제이피모간체이스은행' },
                    { value: '058', label: '미즈호은행' },
                    { value: '059', label: '엠유에프지은행' },
                    { value: '060', label: 'BOA은행' },
                    { value: '061', label: '비엔피파리바은행' },
                    { value: '062', label: '중국공상은행' },
                    { value: '063', label: '중국은행' },
                    { value: '064', label: '산림조합중앙회' },
                    { value: '065', label: '대화은행' },
                    { value: '066', label: '교통은행' },
                    { value: '067', label: '중국건설은행' },
                    { value: '071', label: '우체국' },
                    { value: '076', label: '신용보증기금' },
                    { value: '077', label: '기술보증기금' },
                    { value: '081', label: '하나은행' },
                    { value: '088', label: '신한은행' },
                    { value: '089', label: '케이뱅크' },
                    { value: '090', label: '카카오뱅크' },
                    { value: '092', label: '토스뱅크' },
                    { value: '094', label: '서울보증보험' },
                    { value: '101', label: '한국신용정보원' },
                    { value: '209', label: '유안타증권' },
                    { value: '218', label: 'KB증권' },
                    { value: '221', label: '상상인증권' },
                    { value: '222', label: '한양증권' },
                    { value: '223', label: '리딩투자증권' },
                    { value: '224', label: 'BNK투자증권' },
                    { value: '225', label: 'IBK투자증권' },
                    { value: '227', label: '다올투자증권' },
                    { value: '238', label: '미래에셋증권' },
                    { value: '240', label: '삼성증권' },
                    { value: '243', label: '한국투자증권' },
                    { value: '247', label: 'NH투자증권' },
                    { value: '261', label: '교보증권' },
                    { value: '262', label: '하이투자증권' },
                    { value: '263', label: '현대차증권' },
                    { value: '264', label: '키움증권' },
                    { value: '265', label: '이베스트투자증권' },
                    { value: '266', label: 'SK증권' },
                    { value: '267', label: '대신증권' },
                    { value: '269', label: '한화투자증권' },
                    { value: '270', label: '하나증권' },
                    { value: '271', label: '토스증권' },
                    { value: '272', label: 'NH선물' },
                    { value: '273', label: '코리아에셋투자증권' },
                    { value: '274', label: 'DS투자증권' },
                    { value: '275', label: '흥국증권' },
                    { value: '276', label: '유화증권' },
                    { value: '278', label: '신한투자증권' },
                    { value: '279', label: 'DB금융투자' }
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