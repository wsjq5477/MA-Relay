export type Point={x:number;y:number};
export type Obstacle=Point&{width:number;height:number};

// Search an orthogonal visibility grid around tool cards. Machine backgrounds
// remain traversable; coordinates are graph coordinates, independent of zoom.
export function routeAroundNodes(source:Point,target:Point,cards:Obstacle[]):Point[]|null{
  const margin=18,stub=30;
  const boxes=cards.map(r=>({left:r.x-margin,right:r.x+r.width+margin,top:r.y-margin,bottom:r.y+r.height+margin}));
  const start={x:source.x+stub,y:source.y},end={x:target.x-stub,y:target.y};
  const inside=(p:Point)=>boxes.some(r=>p.x>r.left&&p.x<r.right&&p.y>r.top&&p.y<r.bottom);
  if(inside(start)||inside(end))return null; // Intentionally overlapping cards.
  const clear=(a:Point,b:Point)=>!boxes.some(r=>a.x===b.x
    ?a.x>r.left&&a.x<r.right&&Math.max(a.y,b.y)>r.top&&Math.min(a.y,b.y)<r.bottom
    :a.y>r.top&&a.y<r.bottom&&Math.max(a.x,b.x)>r.left&&Math.min(a.x,b.x)<r.right);
  const simplify=(path:Point[])=>path.filter((p,i)=>i===0||i===path.length-1||!((path[i-1]!.x===p.x&&p.x===path[i+1]!.x)||(path[i-1]!.y===p.y&&p.y===path[i+1]!.y)));
  // Most grouped layouts have clear vertical channels beside each column.
  // Check the nearest horizontal corridor first; use grid search only when
  // irregularly moved groups obstruct these channels. This avoids rebuilding
  // a search tree for every member while dragging a 60-node fan-out.
  const lanes=[...new Set([start.y,end.y,...boxes.flatMap(r=>[r.top,r.bottom])])].sort((a,b)=>Math.abs(a-start.y)+Math.abs(a-end.y)-Math.abs(b-start.y)-Math.abs(b-end.y));
  for(const y of lanes){const a={x:start.x,y},b={x:end.x,y};if(clear(start,a)&&clear(a,b)&&clear(b,end))return simplify([source,start,a,b,end,target]);}
  const xs=[...new Set([start.x,end.x,...boxes.flatMap(r=>[r.left,r.right])])].sort((a,b)=>a-b);
  const ys=[...new Set([start.y,end.y,...boxes.flatMap(r=>[r.top,r.bottom])])].sort((a,b)=>a-b);
  const columns=xs.length,id=(x:number,y:number)=>y*columns+x;
  const point=(i:number):Point=>({x:xs[i%columns]!,y:ys[Math.floor(i/columns)]!});
  const first=id(xs.indexOf(start.x),ys.indexOf(start.y)),last=id(xs.indexOf(end.x),ys.indexOf(end.y));
  const distance=new Map<number,number>([[first,0]]),previous=new Map<number,number>();
  const heap:{id:number;score:number;cost:number}[]=[];
  const push=(item:typeof heap[number])=>{heap.push(item);let i=heap.length-1;while(i>0){const parent=(i-1)>>1;if(heap[parent]!.score<=item.score)break;heap[i]=heap[parent]!;i=parent;}heap[i]=item;};
  const pop=()=>{const head=heap[0]!,tail=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1]!.score<heap[child]!.score)child++;if(heap[child]!.score>=tail.score)break;heap[i]=heap[child]!;i=child;}heap[i]=tail;}return head;};
  const heuristic=(p:Point)=>Math.abs(p.x-end.x)+Math.abs(p.y-end.y);
  push({id:first,cost:0,score:heuristic(start)});
  while(heap.length){
    const current=pop();if(current.cost!==distance.get(current.id))continue;
    if(current.id===last){
      const path:Point[]=[];let i=last;
      while(i!==first){path.push(point(i));i=previous.get(i)!;}path.push(start);path.reverse();
      const full=[source,...path,target];
      return simplify(full);
    }
    const x=current.id%columns,y=Math.floor(current.id/columns),a=point(current.id);
    const neighbors=[...(x>0?[current.id-1]:[]),...(x+1<columns?[current.id+1]:[]),...(y>0?[current.id-columns]:[]),...(y+1<ys.length?[current.id+columns]:[])];
    for(const next of neighbors){const b=point(next);if(!clear(a,b))continue;const cost=current.cost+Math.abs(a.x-b.x)+Math.abs(a.y-b.y);if(cost>=(distance.get(next)??Infinity))continue;distance.set(next,cost);previous.set(next,current.id);push({id:next,cost,score:cost+heuristic(b)});}
  }
  return null;
}
