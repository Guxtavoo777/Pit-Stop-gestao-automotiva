// ─── CARROS POPULARES BR (fotos Unsplash verificadas) ────────────────────────
// As fotos abaixo são IDs verificados do Unsplash que mostram os carros corretos
const CARROS = [
  { marca:'Chevrolet', modelo:'Onix', ano:'2024', categoria:'Hatch',
    img:'/images/onix.jpg',
    motor:'1.0 Turbo Flex', potencia:'116 cv', torque:'16,6 kgfm', cambio:'Automático CVT', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'11,5 km/L', consumo_estrada:'14,2 km/L', porta_malas:'222 litros', preco_base:'R$ 89.990' },

  { marca:'Chevrolet', modelo:'Onix Plus', ano:'2024', categoria:'Sedan',
    img:'/images/onix-plus.jpg',
    motor:'1.0 Turbo Flex', potencia:'116 cv', torque:'16,6 kgfm', cambio:'Automático CVT', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'11,2 km/L', consumo_estrada:'13,9 km/L', porta_malas:'470 litros', preco_base:'R$ 99.990' },

  { marca:'Chevrolet', modelo:'Tracker', ano:'2024', categoria:'SUV',
    img:'/images/tracker.jpg',
    motor:'1.2 Turbo Flex', potencia:'133 cv', torque:'22,4 kgfm', cambio:'Automático CVT', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'10,8 km/L', consumo_estrada:'13,5 km/L', porta_malas:'393 litros', preco_base:'R$ 119.990' },

  { marca:'Volkswagen', modelo:'Polo', ano:'2024', categoria:'Hatch',
    img:'/images/polo.jpg',
    motor:'1.0 TSI Flex', potencia:'116 cv', torque:'20,4 kgfm', cambio:'Automático 6 marchas', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'12,0 km/L', consumo_estrada:'15,1 km/L', porta_malas:'300 litros', preco_base:'R$ 97.990' },

  { marca:'Volkswagen', modelo:'Polo Track', ano:'2024', categoria:'Hatch',
    img:'/images/polo-track.jpg',
    motor:'1.0 MPI Flex', potencia:'84 cv', torque:'9,8 kgfm', cambio:'Manual 5 marchas', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'11,8 km/L', consumo_estrada:'14,5 km/L', porta_malas:'300 litros', preco_base:'R$ 74.990' },

  { marca:'Volkswagen', modelo:'Virtus', ano:'2024', categoria:'Sedan',
    img:'/images/virtus.jpg',
    motor:'1.0 TSI Flex', potencia:'116 cv', torque:'20,4 kgfm', cambio:'Automático 6 marchas', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'11,8 km/L', consumo_estrada:'14,9 km/L', porta_malas:'521 litros', preco_base:'R$ 104.990' },

  { marca:'Volkswagen', modelo:'T-Cross', ano:'2024', categoria:'SUV',
    img:'/images/tcross.jpg',
    motor:'1.4 TSI Flex', potencia:'150 cv', torque:'25,5 kgfm', cambio:'DSG 7 marchas', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'10,5 km/L', consumo_estrada:'13,8 km/L', porta_malas:'373 litros', preco_base:'R$ 129.990' },

  { marca:'Volkswagen', modelo:'Nivus', ano:'2024', categoria:'SUV Coupé',
    img:'/images/nivus.jpg',
    motor:'1.0 TSI Flex', potencia:'116 cv', torque:'20,4 kgfm', cambio:'Automático 6 marchas', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'11,5 km/L', consumo_estrada:'14,5 km/L', porta_malas:'415 litros', preco_base:'R$ 119.990' },

  { marca:'Fiat', modelo:'Argo', ano:'2024', categoria:'Hatch',
    img:'/images/argo.jpg',
    motor:'1.0 Firefly Flex', potencia:'75 cv', torque:'9,7 kgfm', cambio:'Manual 5 marchas', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'11,2 km/L', consumo_estrada:'13,8 km/L', porta_malas:'300 litros', preco_base:'R$ 74.990' },

  { marca:'Fiat', modelo:'Cronos', ano:'2024', categoria:'Sedan',
    img:'/images/cronos.jpg',
    motor:'1.3 Firefly Flex', potencia:'107 cv', torque:'13,6 kgfm', cambio:'Automático CVT', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'11,5 km/L', consumo_estrada:'14,2 km/L', porta_malas:'525 litros', preco_base:'R$ 89.990' },

  { marca:'Fiat', modelo:'Strada', ano:'2024', categoria:'Picape',
    img:'/images/strada.jpg',
    motor:'1.3 Firefly Flex', potencia:'107 cv', torque:'13,6 kgfm', cambio:'Automático CVT', tracao:'Traseira', combustivel:'Flex',
    consumo_cidade:'10,8 km/L', consumo_estrada:'13,5 km/L', porta_malas:'720 litros', preco_base:'R$ 99.990' },

  { marca:'Fiat', modelo:'Pulse', ano:'2024', categoria:'SUV',
    img:'/images/pulse.jpg',
    motor:'1.0 Turbo Flex', potencia:'130 cv', torque:'20,4 kgfm', cambio:'Automático CVT', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'11,0 km/L', consumo_estrada:'14,0 km/L', porta_malas:'370 litros', preco_base:'R$ 109.990' },

  { marca:'Hyundai', modelo:'HB20', ano:'2024', categoria:'Hatch',
    img:'/images/hb20.jpg',
    motor:'1.0 Turbo Flex', potencia:'120 cv', torque:'17,5 kgfm', cambio:'Automático DCT 7 marchas', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'11,8 km/L', consumo_estrada:'14,5 km/L', porta_malas:'300 litros', preco_base:'R$ 89.990' },

  { marca:'Hyundai', modelo:'HB20S', ano:'2024', categoria:'Sedan',
    img:'/images/hb20s.jpg',
    motor:'1.0 Turbo Flex', potencia:'120 cv', torque:'17,5 kgfm', cambio:'Automático DCT 7 marchas', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'11,5 km/L', consumo_estrada:'14,2 km/L', porta_malas:'450 litros', preco_base:'R$ 97.990' },

  { marca:'Hyundai', modelo:'Creta', ano:'2024', categoria:'SUV',
    img:'/images/creta.jpg',
    motor:'2.0 Flex', potencia:'167 cv', torque:'20,9 kgfm', cambio:'Automático 6 marchas', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'9,8 km/L', consumo_estrada:'12,5 km/L', porta_malas:'422 litros', preco_base:'R$ 139.990' },

  { marca:'Toyota', modelo:'Corolla', ano:'2024', categoria:'Sedan',
    img:'/images/corolla.jpg',
    motor:'2.0 Flex', potencia:'177 cv', torque:'21,4 kgfm', cambio:'Automático CVT', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'11,2 km/L', consumo_estrada:'14,8 km/L', porta_malas:'470 litros', preco_base:'R$ 159.990' },

  { marca:'Toyota', modelo:'Hilux', ano:'2024', categoria:'Picape',
    img:'/images/hilux.jpg',
    motor:'2.8 Diesel Turbo', potencia:'204 cv', torque:'51,0 kgfm', cambio:'Automático 6 marchas', tracao:'4x4', combustivel:'Diesel',
    consumo_cidade:'9,5 km/L', consumo_estrada:'12,0 km/L', porta_malas:'756 litros', preco_base:'R$ 269.990' },

  { marca:'Toyota', modelo:'Yaris', ano:'2024', categoria:'Hatch',
    img:'/images/yaris.jpg',
    motor:'1.5 Flex', potencia:'113 cv', torque:'14,4 kgfm', cambio:'Automático CVT', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'12,5 km/L', consumo_estrada:'15,5 km/L', porta_malas:'286 litros', preco_base:'R$ 119.990' },

  { marca:'Jeep', modelo:'Renegade', ano:'2024', categoria:'SUV',
    img:'/images/renegade.jpg',
    motor:'1.3 Turbo Flex', potencia:'185 cv', torque:'27,5 kgfm', cambio:'Automático 9 marchas', tracao:'4x4', combustivel:'Flex',
    consumo_cidade:'9,8 km/L', consumo_estrada:'12,5 km/L', porta_malas:'320 litros', preco_base:'R$ 149.990' },

  { marca:'Jeep', modelo:'Compass', ano:'2024', categoria:'SUV',
    img:'/images/compass.jpg',
    motor:'1.3 Turbo Flex', potencia:'185 cv', torque:'27,5 kgfm', cambio:'Automático 9 marchas', tracao:'4x4', combustivel:'Flex',
    consumo_cidade:'9,5 km/L', consumo_estrada:'12,0 km/L', porta_malas:'438 litros', preco_base:'R$ 189.990' },

  { marca:'Honda', modelo:'City Sedan', ano:'2024', categoria:'Sedan',
    img:'/images/city-sedan.jpg',
    motor:'1.5 Flex', potencia:'126 cv', torque:'15,7 kgfm', cambio:'Automático CVT', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'12,0 km/L', consumo_estrada:'15,2 km/L', porta_malas:'536 litros', preco_base:'R$ 129.990' },

  { marca:'Honda', modelo:'HR-V', ano:'2024', categoria:'SUV',
    img:'/images/hrv.jpg',
    motor:'1.5 Turbo Flex', potencia:'173 cv', torque:'22,5 kgfm', cambio:'Automático CVT', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'10,5 km/L', consumo_estrada:'13,5 km/L', porta_malas:'437 litros', preco_base:'R$ 169.990' },

  { marca:'Nissan', modelo:'Kicks', ano:'2024', categoria:'SUV',
    img:'/images/kicks.jpg',
    motor:'1.6 Flex', potencia:'114 cv', torque:'15,1 kgfm', cambio:'Automático CVT', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'10,8 km/L', consumo_estrada:'13,5 km/L', porta_malas:'432 litros', preco_base:'R$ 129.990' },

  { marca:'Renault', modelo:'Kwid', ano:'2024', categoria:'Hatch',
    img:'/images/kwid.jpg',
    motor:'1.0 Flex', potencia:'66 cv', torque:'9,0 kgfm', cambio:'Manual 5 marchas', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'12,5 km/L', consumo_estrada:'15,8 km/L', porta_malas:'290 litros', preco_base:'R$ 64.990' },

  { marca:'Renault', modelo:'Sandero', ano:'2024', categoria:'Hatch',
    img:'/images/sandero.jpg',
    motor:'1.6 Flex', potencia:'115 cv', torque:'15,5 kgfm', cambio:'Automático CVT', tracao:'Dianteira', combustivel:'Flex',
    consumo_cidade:'11,5 km/L', consumo_estrada:'14,2 km/L', porta_malas:'320 litros', preco_base:'R$ 89.990' },

  { marca:'BMW', modelo:'X1', ano:'2024', categoria:'SUV Premium',
    img:'/images/x1.jpg',
    motor:'2.0 Turbo', potencia:'231 cv', torque:'36,7 kgfm', cambio:'Automático 8 marchas', tracao:'AWD', combustivel:'Gasolina',
    consumo_cidade:'9,5 km/L', consumo_estrada:'12,5 km/L', porta_malas:'540 litros', preco_base:'R$ 299.990' },

  { marca:'Ford', modelo:'Ranger', ano:'2024', categoria:'Picape',
    img:'/images/ranger.jpg',
    motor:'3.0 V6 Turbo Diesel', potencia:'250 cv', torque:'60,2 kgfm', cambio:'Automático 10 marchas', tracao:'4x4', combustivel:'Diesel',
    consumo_cidade:'8,5 km/L', consumo_estrada:'11,0 km/L', porta_malas:'862 litros', preco_base:'R$ 269.990' },
];

module.exports = CARROS;