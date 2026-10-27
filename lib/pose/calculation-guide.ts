/** Model-facing rules matching the existing presets.ts helpers; not an IK solver. */
function armExample(label: string, up: number, fwd: number, bend: number) {
  const t = up * Math.PI / 180;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    label,
    parametersDegrees: { up, fwd, bend },
    shoulder: [0, -fwd, up],
    elbow: [round(-Math.sin(t) * bend), round(-Math.cos(t) * bend), 0],
  };
}

export const POSE_CALCULATION_GUIDE = {
  authority: "이 공식은 components/pose-editor/presets.ts의 의미 헬퍼와 같다. 포즈 후보를 만드는 규칙이며 실제 접촉을 보장하는 역기구학(IK) 해법은 아니다.",
  units: [
    "출력 joints는 [x,y,z] 로컬 Euler XYZ 회전 델타이며 도(degree) 단위다. 관절의 위치 좌표가 아니다.",
    "sin/cos/atan2 계산 때만 라디안을 사용한다. t = degrees * PI / 180. 결과 JSON에 계산식이나 라디안을 쓰지 말고 계산된 숫자를 쓴다.",
    "왼팔/오른팔에 같은 의미 동작을 줄 때 아래 공식을 동일하게 적용한다. 좌우라는 이유만으로 부호를 반전하지 않는다.",
    "축의 화면 방향 설명은 기본 카메라·yaw=0 기준이다. 카메라가 회전하면 화면 방향과 월드 방향은 달라진다.",
  ],
  arm: {
    parameters: {
      up: "T 포즈의 수평 팔=0, 아래=-90, 위=+90. -18은 팔을 거의 옆으로 벌린 상태이며 팔을 앞으로 뻗는 값이 아니다.",
      fwd: "양수는 앞으로, 음수는 뒤로 보내는 의미 파라미터. shoulder.y에는 반대 부호로 넣는다.",
      bend: "팔꿈치 굽힘 크기. 0은 곧게 펴기. 어깨 up에 맞춰 elbow.x와 elbow.y에 분배한다.",
    },
    formula: {
      t: "up * PI / 180",
      shoulder: "[0, -fwd, up]",
      elbow: "[-sin(t) * bend, -cos(t) * bend, 0]",
    },
    rules: [
      "한 팔마다 up/fwd/bend를 먼저 정한 뒤 shoulder와 elbow를 반드시 한 쌍으로 계산한다.",
      "기본 후보는 up/fwd를 각각 [-120,120], bend를 [0,120] 안에서 선택한다. 이 범위는 에디터 제한이지 인체 관절의 물리적 유효성을 보장하지 않는다.",
      "어깨가 바뀌면 팔꿈치를 다시 계산한다. elbow.x만 bend로 채우는 방식은 사용하지 않는다.",
      "손목 회전은 손의 방향을 조절한다. 손목 위치를 목표점으로 옮기는 대체 수단이 아니다.",
      "오른손과 왼손의 목표가 다르면 각 팔의 파라미터를 별도로 선택한다. 양팔에 같은 배열을 복사하지 않는다.",
    ],
    examples: [
      armExample("기본 서기: 기존 base 프리셋의 한 팔", -78, 0, 10),
      armExample("팔 수평에서 앞으로 굽힘", 0, 0, 65),
      armExample("문제 사례의 up=-18에서 bend=65를 공식으로 계산", -18, 0, 65),
      armExample("대화 손짓: 기존 talk 프리셋의 팔", -58, 26, 70),
      armExample("악수 후보: 기존 handshake 프리셋의 팔, 접촉 검증 필요", -30, 74, 44),
    ],
    counterexample: {
      input: { shoulder: [0, 0, -18], elbow: [65, 0, 0] },
      reason: "팔은 수평에서 18도만 내려갔고 앞으로 보내는 fwd가 0이다. 팔꿈치도 up=-18에 맞는 축 분배가 아니다. 이 값만으로 정수리/턱 접촉을 표현했다고 판단하지 않는다.",
    },
  },
  otherJointFormulas: {
    hip: "fwd=다리 앞으로, out=바깥 벌림 → [out, 0, fwd]",
    knee: "bend=무릎 굽힘 → [0, 0, -bend]",
    ankle: "flex=발끝 들기 → [0, 0, flex]",
    spine: "bend=숙임, turn=회전, tilt=기울임 → [bend, turn, -tilt]",
    chest: "같은 의미 파라미터 → [turn, tilt, -bend]",
    neckAndHead: "nod=고개 숙임, turn=회전, tilt=기울임 → [turn, tilt, -nod]",
    caution: "각 관절의 limitsDegrees를 따로 확인한다. neck/head에 큰 값을 중복 적용하면 체인에서 회전이 누적된다. 손가락/손목의 정밀 의미 축은 이 맵에서 충분히 보정되지 않았으므로 임의의 접촉 정답을 주장하지 않는다.",
  },
  placement: {
    forward: "yawRad=yawDegrees*PI/180; forward=[sin(yawRad),0,cos(yawRad)]",
    faceTarget: "dx=target.x-self.x; dz=target.z-self.z; yawDegrees=atan2(dx,dz)*180/PI. dx=dz=0이면 방향을 계산하지 말고 기존 yaw를 유지한다.",
    behind: "동일 방향으로 앞뒤 배치: behind.position=front.position-distance*front.forward (Y는 별도로 유지). yaw=0에서 뒤쪽은 -Z다.",
    height: "서 있는 사람의 position.y는 기본 0이다. y=0.45는 몸 전체를 0.45만큼 들어 올리는 것이며 키 차이/팔 도달 문제의 해결책이 아니다.",
    scale: "기본 1, 허용 0.4~2. 요청에 키 차이가 없으면 접촉을 맞추기 위해 임의로 키를 바꾸지 않는다.",
    distance: "position은 인물 기준점이지 손 좌표가 아니다. 기준점 거리가 가까워도 손이 닿는 것은 아니다.",
  },
  contactPlanning: [
    "1. 인물별 역할·배열 순서와 서 있는 위치/yaw를 정한다. description을 쓰는 것만으로 자세가 실행되지는 않는다.",
    "2. 각 팔의 담당 목표를 분리한다. 예: 뒤 인물 wrist_l→앞 인물 head(정수리), wrist_r→앞 인물 head(턱). 어느 손을 쓸지는 명시하고 반대 손과 구별한다.",
    "3. 현재 스키마에는 정수리·턱의 별도 landmark/offset이 없다. target.joint=head는 머리 관절 기준점일 뿐이다. 세부 목표는 description에 쓰되 그 위치가 수치적으로 검증됐다고 주장하지 않는다.",
    "4. 각 팔의 up/fwd/bend를 독립적으로 정하고 공식으로 joints에 기록한다. contacts에는 source/target figureId와 joint, kind를 기록한다. kind는 touch/hold/support/block/near 중 하나다.",
    "5. 정확한 접촉 판정은 실제 리그의 rest 변환·부모 체인·인물 변환으로 구한 월드 좌표가 필요하다. 이 컨텍스트에는 뼈 길이/월드 좌표 측정값이 없으므로 임의 길이를 만들어 도달했다고 결론 내리지 않는다.",
    "6. contacts.maxDistance는 목표 허용 거리일 뿐 자동 계산/강제되지 않는다. 손과 목표점의 실측 거리 없이 접촉 성공을 주장하지 않는다. 최종 후보는 3D 미리보기에서 확인한다.",
  ],
  beforeOutput: [
    "figures는 1~3개, id는 고유하며 contacts가 참조하는 figureId가 실제 존재하는가?",
    "joints의 누락값은 T 포즈로 초기화된다. 몸 옆으로 내릴 팔도 shoulder/elbow를 명시했는가?",
    "모든 값이 계산된 유한 숫자이고 degree 단위이며 관절별 한계 안인가?",
    "양손의 목표가 다른데 같은 값을 복사하지 않았는가? 어깨를 바꾼 뒤 팔꿈치 축을 재계산했는가?",
    "description과 각 팔·인물 배치가 모순되지 않는가? 서 있는 인물을 이유 없이 띄우거나 확대하지 않았는가?",
    "최종 출력은 기존 clicktoon.pose-intent/v1 형식만 사용한다. up/fwd/bend는 계산 과정이며 joints 대신 출력할 필드가 아니다.",
  ],
};
