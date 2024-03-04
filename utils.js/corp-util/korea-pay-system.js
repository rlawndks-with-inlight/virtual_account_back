import axios from "axios";
import { returnMoment } from "../function.js";

const API_URL = `https://api.cashes.co.kr`;

const getDefaultBody = (dns_data, pay_type) => {

    return {
        compUuid: dns_data[`${pay_type}_guid`],
    }
}
export const koreaPaySystemApi = {
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
                    { value: '081', label: 'KEB하나은행', },
                    { value: '088', label: '신한은행', },
                    { value: '089', label: '케이뱅크', },
                    { value: '090', label: '카카오뱅크', },
                    { value: '092', label: '토스뱅크', },
                    { value: '209', label: '유안타증권', },
                    { value: '218', label: '현대증권', },
                    { value: '230', label: '미래에셋증권', },
                    { value: '238', label: '대우증권', },
                    { value: '247', label: '우리투자증권', },
                    { value: '261', label: '교보증권', },
                    { value: '262', label: '하이투자증권', },
                    { value: '263', label: '에이치엠씨투자증권', },
                    { value: '264', label: '키움증권', },
                    { value: '265', label: '이트레이드증권', },
                    { value: '266', label: '에스케이증권', },
                    { value: '267', label: '대신증권', },
                    { value: '268', label: '솔로몬투자증권', },
                    { value: '269', label: '한화증권', },
                    { value: '270', label: '하나대투증권', },
                    { value: '278', label: '굿모닝신한증권', },
                    { value: '279', label: '동부증권', },
                    { value: '280', label: '유진투자증권', },
                    { value: '287', label: '메리츠증권', },
                    { value: '289', label: '엔에이치투자증권', },
                    { value: '290', label: '부국증권', },
                    { value: '291', label: '신영증권', },
                    { value: '292', label: '엘아이지투자증권', },
                    { value: '288', label: '카카오페이증권', },
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
}