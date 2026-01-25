import type { CharacterId } from './ids';

export type FactionId = 'shu' | 'wei' | 'wu';

export type CharacterConfig = {
  id: CharacterId;
  name: string;
  faction: FactionId;
  primaryColor: number;
  secondaryColor: number;
};

export const CHARACTER_CONFIGS: Record<CharacterId, CharacterConfig> = {
  liuBei: { id: 'liuBei', name: 'Liu Bei', faction: 'shu', primaryColor: 0x2ecc71, secondaryColor: 0xf1c40f },
  guanYu: { id: 'guanYu', name: 'Guan Yu', faction: 'shu', primaryColor: 0x27ae60, secondaryColor: 0xc0392b },
  zhangFei: { id: 'zhangFei', name: 'Zhang Fei', faction: 'shu', primaryColor: 0x16a085, secondaryColor: 0x8e44ad },
  zhugeLiang: { id: 'zhugeLiang', name: 'Zhuge Liang', faction: 'shu', primaryColor: 0x2ecc71, secondaryColor: 0xecf0f1 },

  xiahouDun: { id: 'xiahouDun', name: 'Xiahou Dun', faction: 'wei', primaryColor: 0x34495e, secondaryColor: 0x2c3e50 },
  zhangLiao: { id: 'zhangLiao', name: 'Zhang Liao', faction: 'wei', primaryColor: 0x8e1b1b, secondaryColor: 0x95a5a6 },
  caoCao: { id: 'caoCao', name: 'Cao Cao', faction: 'wei', primaryColor: 0x111111, secondaryColor: 0xf1c40f },
  dianWei: { id: 'dianWei', name: 'Dian Wei', faction: 'wei', primaryColor: 0xb7955f, secondaryColor: 0x111111 },

  ganNing: { id: 'ganNing', name: 'Gan Ning', faction: 'wu', primaryColor: 0x9b59b6, secondaryColor: 0xf1c40f },
  sunShangxiang: { id: 'sunShangxiang', name: 'Sun Shangxiang', faction: 'wu', primaryColor: 0xe74c3c, secondaryColor: 0xecf0f1 },
  zhouYu: { id: 'zhouYu', name: 'Zhou Yu', faction: 'wu', primaryColor: 0xe74c3c, secondaryColor: 0xbdc3c7 },
  taiShiCi: { id: 'taiShiCi', name: 'Tai Shi Ci', faction: 'wu', primaryColor: 0x3498db, secondaryColor: 0xa67c52 }
};

