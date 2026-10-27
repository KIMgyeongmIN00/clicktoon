# 클릭툰 프로젝트 문서

이 폴더는 현재 구현의 안내와 기존 설계·시연 기록을 함께 보관한다. 운영 준비의 출발점은 [서비스 구조와 운영 준비](./service-architecture-and-operations.md)다.

| 문서 | 용도와 주의점 |
| --- | --- |
| [서비스 구조와 운영 준비](./service-architecture-and-operations.md) | 2026-10-19 기준 코드 조사, 전체 흐름, 설정, 위험과 운영 준비 체크리스트 |
| [Mixpanel 행동 분석](./analytics.md) | 이벤트 중앙 레지스트리, 전체 사용처·속성, 사용자 식별, 활성화·검증 방법 |
| [자연어 → 3D 포즈 수치 데이터 맵](./pose-numeric-data-map.md) | 관절별 회전 의미, 2인 관계·접촉 메타데이터, AI 입력·변환 계약 |
| [AI 생성 파이프라인 설계](./SDD-ai-generation-pipeline.md) | 설계 의도와 단계별 결정. 계획과 실제 구현이 다를 수 있다. |
| [생성 큐 신뢰성](./ai-generation-queue-reliability.md) | 큐·콜백·복구 메커니즘의 상세 설명. 현재 코드와 대조해 사용한다. |
| [시연 흐름](./demo-flow.md) | 데모 모드 설정과 시연 방법. 실제 AI 생성과 구분한다. |
| [기술 구현 보고서](./technical-implementation-report.md) | 기존 구현 보고서. 작성 시점의 기록이다. |

루트 [README](../README.md)는 과거 진입코드·라우트·포트 설명이 남아 있어 현재 구현의 기준으로 사용하지 않는다. 구현과 문서가 다르면 코드와 실제 배포 설정을 확인하고 문서를 함께 갱신한다. 비밀번호, API 키, 서명된 URL과 고객 데이터는 문서에 기록하지 않는다.
