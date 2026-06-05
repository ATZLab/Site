/**
 * Service registry. Add a new service in 3 steps:
 *   1. Add a folder under `src/services/<id>/` with its own logic/components.
 *   2. Add a route under `src/app/(lab)/<route>/page.tsx`.
 *   3. Register it below.
 *
 * Each entry powers the lab index page and the landing-page preview.
 */
export interface ServiceMeta {
  id: string;
  label: string;
  description: string;
  route: string;
}

export const services: ServiceMeta[] = [
  {
    id: 'ladder',
    label: '사다리 타기',
    description: '이름과 항목을 입력하면 경로를 추적해 매칭해줘요.',
    route: '/lab/ladder',
  },
  {
    id: 'fortune',
    label: '오늘의 운세',
    description: '학업·직장·돈·연애·건강 — 가볍게 보는 일일 운세.',
    route: '/lab/fortune',
  },
  {
    id: 'game-2048',
    label: '2048',
    description: '방향키로 타일 합치기 — 3×3 / 4×4 / 5×5.',
    route: '/lab/game-2048',
  },
];
