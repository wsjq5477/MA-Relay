const {test}=require('node:test'),assert=require('node:assert/strict');
const routing=import('../src/graph-routing.ts');
const card=(x,y)=>({x,y,width:280,height:132});
function avoids(path,cards){
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];assert(a.x===b.x||a.y===b.y,'orthogonal segment');
    for(const r of cards)assert(!(a.x===b.x?a.x>r.x&&a.x<r.x+r.width&&Math.max(a.y,b.y)>r.y&&Math.min(a.y,b.y)<r.y+r.height:a.y>r.y&&a.y<r.y+r.height&&Math.max(a.x,b.x)>r.x&&Math.min(a.x,b.x)<r.x+r.width),'segment crosses a tool card');
  }
}
test('same-row right-to-left authorization leaves the source on its right and enters the target on its left',async()=>{
  const {routeAroundNodes}=await routing,cards=[card(480,130),card(40,130)],source={x:772,y:196},target={x:28,y:196};
  const path=routeAroundNodes(source,target,cards);assert(path);assert.deepEqual(path[0],source);assert.deepEqual(path.at(-1),target);assert(path[1].x>source.x);assert(path.at(-2).x<target.x);avoids(path,cards);
});
test('forward edge avoids an intermediate card',async()=>{
  const {routeAroundNodes}=await routing,cards=[card(40,130),card(480,130),card(920,130)];
  const path=routeAroundNodes({x:332,y:196},{x:908,y:196},cards);assert(path);avoids(path,cards);
});
test('routing follows moved groups including negative coordinates',async()=>{
  const {routeAroundNodes}=await routing,cards=[card(-600,-300),card(-160,165),card(-160,10)];
  const path=routeAroundNodes({x:-308,y:-234},{x:-172,y:231},cards);assert(path);avoids(path,cards);
});
test('irregular obstacles blocking both simple corridors still have a safe grid route',async()=>{
  const {routeAroundNodes}=await routing,cards=[card(40,130),card(480,130),card(920,130),{x:350,y:110,width:50,height:30},{x:350,y:250,width:50,height:30}];
  const path=routeAroundNodes({x:332,y:196},{x:908,y:196},cards);assert(path);avoids(path,cards);
});
test('a 20-group / 60-node fan-out has an unobstructed route to every member',async()=>{
  const {routeAroundNodes}=await routing,cards=Array.from({length:60},(_,i)=>card((Math.floor(i/3)%2)*440+40,Math.floor(i/6)*680+130+(i%3)*155));
  for(const target of cards.slice(1)){const path=routeAroundNodes({x:332,y:196},{x:target.x-12,y:target.y+66},cards);assert(path);avoids(path,cards);}
});
test('overlapping endpoint cards report no safe corridor instead of claiming obstacle avoidance',async()=>{
  const {routeAroundNodes}=await routing;
  assert.equal(routeAroundNodes({x:332,y:196},{x:128,y:196},[card(40,130),card(140,130)]),null);
});
