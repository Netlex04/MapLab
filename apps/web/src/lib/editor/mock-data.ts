import type { EditorParsedECU, EditorParsedMap } from './types'

// Realistic MS43 map data based on N42B20/N46B20 (BMW 2.0L N/A)
// Offsets are plausible but not production-accurate — awaiting real parser

const RPM_8 = [800, 1200, 1600, 2400, 3200, 4000, 5000, 6000]
const RPM_6 = [1200, 2000, 3000, 4000, 5000, 6000]
const LOAD_6 = [10, 20, 40, 60, 80, 100]
const LOAD_4 = [20, 40, 70, 100]

const torqueLimiter: EditorParsedMap = {
  id: 'ms43_torque_limiter',
  name: 'Torque Limiter',
  group: 'TORQUE',
  offset: 0x00A400,
  rows: 6,
  cols: 8,
  xAxisLabel: 'RPM',
  yAxisLabel: 'Load %',
  xAxisValues: RPM_8,
  yAxisValues: LOAD_6,
  values: [
    [85,  90,  95,  100, 100, 100,  95,  90],
    [90, 105, 115,  130, 135, 130, 120, 110],
    [100, 120, 140, 155, 160, 155, 145, 130],
    [110, 135, 155, 170, 175, 170, 160, 145],
    [115, 140, 160, 178, 185, 182, 170, 155],
    [120, 145, 165, 182, 190, 188, 175, 160],
  ],
  unit: 'Nm',
  min: 85,
  max: 190,
}

const lambdaTarget: EditorParsedMap = {
  id: 'ms43_lambda_target',
  name: 'Lambda Target',
  group: 'FUEL',
  offset: 0x00B200,
  rows: 6,
  cols: 8,
  xAxisLabel: 'RPM',
  yAxisLabel: 'Load %',
  xAxisValues: RPM_8,
  yAxisValues: LOAD_6,
  values: [
    [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    [1.00, 1.00, 1.00, 1.00, 1.00, 0.99, 0.99, 0.98],
    [1.00, 1.00, 1.00, 0.99, 0.97, 0.95, 0.93, 0.91],
    [1.00, 0.99, 0.97, 0.95, 0.92, 0.90, 0.88, 0.86],
    [0.98, 0.96, 0.92, 0.88, 0.85, 0.83, 0.82, 0.81],
    [0.95, 0.90, 0.87, 0.83, 0.80, 0.78, 0.76, 0.75],
  ],
  unit: 'λ',
  min: 0.75,
  max: 1.00,
}

const ignitionAdvance: EditorParsedMap = {
  id: 'ms43_ignition_advance',
  name: 'Ignition Advance',
  group: 'IGNITION',
  offset: 0x00C100,
  rows: 6,
  cols: 8,
  xAxisLabel: 'RPM',
  yAxisLabel: 'Load %',
  xAxisValues: RPM_8,
  yAxisValues: LOAD_6,
  values: [
    [5,  8,  11, 14, 17, 20, 21, 20],
    [10, 14, 18, 22, 25, 27, 26, 24],
    [12, 17, 21, 24, 27, 28, 26, 23],
    [10, 14, 18, 21, 24, 24, 22, 20],
    [ 8, 11, 15, 18, 20, 21, 19, 17],
    [ 6,  9, 12, 15, 17, 17, 15, 13],
  ],
  unit: '°KW',
  min: 5,
  max: 28,
}

const vvtIntake: EditorParsedMap = {
  id: 'ms43_vvt_intake',
  name: 'VVT Intake',
  group: 'VVT',
  offset: 0x00D800,
  rows: 4,
  cols: 6,
  xAxisLabel: 'RPM',
  yAxisLabel: 'Load %',
  xAxisValues: RPM_6,
  yAxisValues: LOAD_4,
  values: [
    [ 0,  5, 10, 15, 15, 10],
    [ 5, 15, 25, 30, 28, 20],
    [10, 20, 32, 38, 35, 25],
    [ 8, 18, 30, 40, 38, 28],
  ],
  unit: '°',
  min: 0,
  max: 40,
}

const MS43_ECU: EditorParsedECU = {
  ecuType: 'MS43',
  maps: [torqueLimiter, lambdaTarget, ignitionAdvance, vvtIntake],
}

export function getMockECU(_ecuType: string | null): EditorParsedECU {
  return MS43_ECU
}
