// Firestore references are runtime objects; persist their paths only. Owner
// requests deliberately have no device reference because that quota is exempt.
export function storeMediaReservation(reservation){
  const {session,...cost}=reservation;
  return {...cost,session:{refs:Object.fromEntries(Object.entries(session.refs).filter(([,ref])=>ref).map(([name,ref])=>[name,ref.path]))}};
}
export function restoreMediaReservation(stored,db){
  return {...stored,session:{refs:Object.fromEntries(Object.entries(stored.session.refs).map(([name,path])=>[name,db.doc(path)]))}};
}
