import { Fortress } from '@/services/fortress/components/Fortress';

export const metadata = {
  title: '포트리스 · Site',
  description: '턴제 포물선 대전. 1P vs AI 또는 2P 한 기기 대전, 바람과 파워 게이지로 명중률을 조절하세요.',
};

export default function FortressPage() {
  return <Fortress />;
}
