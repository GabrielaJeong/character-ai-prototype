/**
 * Explore 랭킹 차트 mock 데이터.
 * 원본 app.js _chartData / _chartLabels (L1713~1786) 그대로 이식.
 *
 * ⚠️ 시연용 하드코딩 데이터 (실제 집계 API 없음). 포트폴리오 차트 UI 데모.
 */

export type ChartSort = 'daily' | 'weekly' | 'monthly';
export type ChartDir = 'up' | 'down' | 'none';

export interface ChartItem {
  rank: number;
  name: string;
  role: string;
  chats: string;
  img: string;
  change: number;
  dir: ChartDir;
}

export const CHART_DATA: Record<ChartSort, ChartItem[]> = {
  daily: [
    { rank: 1, name: '이화', role: '프로파일러', chats: '12.4k', img: '/images/ihwa.png', change: 2, dir: 'up' },
    { rank: 2, name: '박재헌', role: '서울 사장', chats: '8.9k', img: '/images/jaeheon.png', change: 1, dir: 'down' },
    { rank: 3, name: '지세현', role: '메인 작가', chats: '7.2k', img: '/images/sehyun.png', change: 0, dir: 'none' },
    { rank: 4, name: '한윤서', role: '심야 DJ', chats: '6.3k', img: '/images/coming1.jpg', change: 4, dir: 'up' },
    { rank: 5, name: '강도윤', role: '형사', chats: '4.7k', img: '/images/coming2.jpg', change: 2, dir: 'down' },
    { rank: 6, name: '오영일', role: '소설 편집자', chats: '4.1k', img: '/images/yujin.png', change: 3, dir: 'up' },
    { rank: 7, name: '최시원', role: '사진작가', chats: '3.8k', img: '/images/coming3.jpg', change: 1, dir: 'down' },
    { rank: 8, name: '한세아', role: '소설가', chats: '3.5k', img: '/images/coming4.jpg', change: 0, dir: 'none' },
    { rank: 9, name: '이준혁', role: '인디 뮤지션', chats: '3.1k', img: '/images/coming2.jpg', change: 5, dir: 'up' },
    { rank: 10, name: '김유진', role: '바리스타', chats: '2.9k', img: '/images/coming1.jpg', change: 2, dir: 'down' },
    { rank: 11, name: '박소율', role: '웹툰 작가', chats: '2.6k', img: '/images/coming3.jpg', change: 1, dir: 'up' },
    { rank: 12, name: '서민준', role: '변호사', chats: '2.4k', img: '/images/coming4.jpg', change: 3, dir: 'down' },
    { rank: 13, name: '정하은', role: '심리상담사', chats: '2.2k', img: '/images/ihwa.png', change: 0, dir: 'none' },
    { rank: 14, name: '윤재원', role: '북카페 사장', chats: '2.0k', img: '/images/jaeheon.png', change: 2, dir: 'up' },
    { rank: 15, name: '류다현', role: '야간 간호사', chats: '1.8k', img: '/images/sehyun.png', change: 1, dir: 'down' },
    { rank: 16, name: '임서진', role: '건축 설계사', chats: '1.7k', img: '/images/yujin.png', change: 4, dir: 'up' },
    { rank: 17, name: '강민서', role: '유학생', chats: '1.5k', img: '/images/coming1.jpg', change: 0, dir: 'none' },
    { rank: 18, name: '오지안', role: '마케터', chats: '1.3k', img: '/images/coming2.jpg', change: 2, dir: 'down' },
    { rank: 19, name: '문채원', role: '로스쿨 학생', chats: '1.2k', img: '/images/coming3.jpg', change: 1, dir: 'up' },
    { rank: 20, name: '신우혁', role: '스타트업 CEO', chats: '1.0k', img: '/images/coming4.jpg', change: 3, dir: 'down' },
  ],
  weekly: [
    { rank: 1, name: '이화', role: '프로파일러', chats: '58.2k', img: '/images/ihwa.png', change: 2, dir: 'up' },
    { rank: 2, name: '박재헌', role: '서울 사장', chats: '41.7k', img: '/images/jaeheon.png', change: 1, dir: 'down' },
    { rank: 3, name: '지세현', role: '메인 작가', chats: '37.4k', img: '/images/sehyun.png', change: 0, dir: 'none' },
    { rank: 4, name: '한윤서', role: '심야 DJ', chats: '29.1k', img: '/images/coming1.jpg', change: 4, dir: 'up' },
    { rank: 5, name: '강도윤', role: '형사', chats: '22.6k', img: '/images/coming2.jpg', change: 2, dir: 'down' },
    { rank: 6, name: '오영일', role: '소설 편집자', chats: '19.3k', img: '/images/yujin.png', change: 1, dir: 'up' },
    { rank: 7, name: '최시원', role: '사진작가', chats: '17.8k', img: '/images/coming3.jpg', change: 3, dir: 'down' },
    { rank: 8, name: '한세아', role: '소설가', chats: '15.2k', img: '/images/coming4.jpg', change: 0, dir: 'none' },
    { rank: 9, name: '이준혁', role: '인디 뮤지션', chats: '13.9k', img: '/images/coming2.jpg', change: 6, dir: 'up' },
    { rank: 10, name: '김유진', role: '바리스타', chats: '12.1k', img: '/images/coming1.jpg', change: 2, dir: 'down' },
    { rank: 11, name: '박소율', role: '웹툰 작가', chats: '10.8k', img: '/images/coming3.jpg', change: 1, dir: 'up' },
    { rank: 12, name: '서민준', role: '변호사', chats: '9.4k', img: '/images/coming4.jpg', change: 4, dir: 'down' },
    { rank: 13, name: '정하은', role: '심리상담사', chats: '8.7k', img: '/images/ihwa.png', change: 0, dir: 'none' },
    { rank: 14, name: '윤재원', role: '북카페 사장', chats: '7.9k', img: '/images/jaeheon.png', change: 2, dir: 'up' },
    { rank: 15, name: '류다현', role: '야간 간호사', chats: '7.1k', img: '/images/sehyun.png', change: 1, dir: 'down' },
    { rank: 16, name: '임서진', role: '건축 설계사', chats: '6.3k', img: '/images/yujin.png', change: 5, dir: 'up' },
    { rank: 17, name: '강민서', role: '유학생', chats: '5.6k', img: '/images/coming1.jpg', change: 0, dir: 'none' },
    { rank: 18, name: '오지안', role: '마케터', chats: '4.9k', img: '/images/coming2.jpg', change: 3, dir: 'down' },
    { rank: 19, name: '문채원', role: '로스쿨 학생', chats: '4.2k', img: '/images/coming3.jpg', change: 1, dir: 'up' },
    { rank: 20, name: '신우혁', role: '스타트업 CEO', chats: '3.7k', img: '/images/coming4.jpg', change: 2, dir: 'down' },
  ],
  monthly: [
    { rank: 1, name: '박재헌', role: '서울 사장', chats: '198k', img: '/images/jaeheon.png', change: 0, dir: 'none' },
    { rank: 2, name: '이화', role: '프로파일러', chats: '174k', img: '/images/ihwa.png', change: 3, dir: 'up' },
    { rank: 3, name: '한윤서', role: '심야 DJ', chats: '142k', img: '/images/coming1.jpg', change: 1, dir: 'up' },
    { rank: 4, name: '지세현', role: '메인 작가', chats: '119k', img: '/images/sehyun.png', change: 2, dir: 'down' },
    { rank: 5, name: '강도윤', role: '형사', chats: '97k', img: '/images/coming2.jpg', change: 1, dir: 'down' },
    { rank: 6, name: '이준혁', role: '인디 뮤지션', chats: '83k', img: '/images/coming2.jpg', change: 5, dir: 'up' },
    { rank: 7, name: '오영일', role: '소설 편집자', chats: '71k', img: '/images/yujin.png', change: 2, dir: 'up' },
    { rank: 8, name: '최시원', role: '사진작가', chats: '64k', img: '/images/coming3.jpg', change: 0, dir: 'none' },
    { rank: 9, name: '한세아', role: '소설가', chats: '58k', img: '/images/coming4.jpg', change: 3, dir: 'down' },
    { rank: 10, name: '서민준', role: '변호사', chats: '49k', img: '/images/coming4.jpg', change: 1, dir: 'up' },
    { rank: 11, name: '김유진', role: '바리스타', chats: '43k', img: '/images/coming1.jpg', change: 2, dir: 'down' },
    { rank: 12, name: '정하은', role: '심리상담사', chats: '38k', img: '/images/ihwa.png', change: 4, dir: 'up' },
    { rank: 13, name: '박소율', role: '웹툰 작가', chats: '33k', img: '/images/coming3.jpg', change: 0, dir: 'none' },
    { rank: 14, name: '윤재원', role: '북카페 사장', chats: '28k', img: '/images/jaeheon.png', change: 1, dir: 'down' },
    { rank: 15, name: '임서진', role: '건축 설계사', chats: '24k', img: '/images/yujin.png', change: 6, dir: 'up' },
    { rank: 16, name: '류다현', role: '야간 간호사', chats: '21k', img: '/images/sehyun.png', change: 2, dir: 'down' },
    { rank: 17, name: '강민서', role: '유학생', chats: '18k', img: '/images/coming1.jpg', change: 0, dir: 'none' },
    { rank: 18, name: '신우혁', role: '스타트업 CEO', chats: '15k', img: '/images/coming2.jpg', change: 3, dir: 'up' },
    { rank: 19, name: '오지안', role: '마케터', chats: '12k', img: '/images/coming3.jpg', change: 1, dir: 'down' },
    { rank: 20, name: '문채원', role: '로스쿨 학생', chats: '9k', img: '/images/coming4.jpg', change: 2, dir: 'up' },
  ],
};

interface ChartLabel {
  eyebrow: string;
  title: string;
  date: () => string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const CHART_LABELS: Record<ChartSort, ChartLabel> = {
  daily: {
    eyebrow: 'CHART.DAILY',
    title: 'TODAY · TOP 20',
    date: () => {
      const d = new Date();
      return `${d.getMonth() + 1}.${pad(d.getDate())}`;
    },
  },
  weekly: {
    eyebrow: 'CHART.WEEKLY',
    title: 'THIS WEEK · TOP 20',
    date: () => {
      const d = new Date();
      const mon = new Date(d);
      mon.setDate(d.getDate() - d.getDay() + 1);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return `${mon.getMonth() + 1}.${pad(mon.getDate())} — ${sun.getMonth() + 1}.${pad(sun.getDate())}`;
    },
  },
  monthly: {
    eyebrow: 'CHART.MONTHLY',
    title: 'THIS MONTH · TOP 20',
    date: () => {
      const d = new Date();
      return `${d.getFullYear()}.${pad(d.getMonth() + 1)}`;
    },
  },
};
