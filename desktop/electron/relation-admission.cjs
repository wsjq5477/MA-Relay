// Only newly admitted roles need live capability and management checks.
// Retained or removed roles must not prevent the user from reducing access.
function relationAdmissionTargets(current,next){
 return [...new Set([
  ...(next.leaderId&&next.leaderId!==current.leaderId?[next.leaderId]:[]),
  ...next.memberIds.filter(id=>!current.memberIds.includes(id)),
 ])];
}
module.exports={relationAdmissionTargets};
