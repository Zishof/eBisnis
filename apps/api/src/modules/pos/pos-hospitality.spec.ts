import { HOSPITALITY_OUTLET_TYPES, KITCHEN_TRANSITIONS } from './pos-hospitality.service';
describe('shared POS hospitality extension',()=>{
  it('mendukung outlet hotel pada PosModule yang sama',()=>expect(HOSPITALITY_OUTLET_TYPES).toEqual(['RESTAURANT','BAR','ROOM_SERVICE','MINIBAR','RETAIL','SPA']));
  it('tidak mengizinkan kitchen ticket kembali dari served',()=>expect(KITCHEN_TRANSITIONS.SERVED).toEqual([]));
});
