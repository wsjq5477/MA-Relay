<script setup>
import {onMounted,watch,ref,nextTick} from 'vue';
import {useData} from 'vitepress';
const props=defineProps({encoded:{type:String,required:true}}),svg=ref(''),error=ref('');
const {isDark}=useData();let generation=0;
async function draw(){
  const mine=++generation;error.value='';
  try{
    const {default:mermaid}=await import('mermaid');
    mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:isDark.value?'dark':'default',fontFamily:'system-ui, sans-serif'});
    const code=new TextDecoder().decode(Uint8Array.from(atob(props.encoded),c=>c.charCodeAt(0)));
    const result=await mermaid.render('diagram-'+crypto.randomUUID(),code);
    if(mine===generation)svg.value=result.svg;
  }catch(e){if(mine===generation)error.value='图表暂时无法渲染：'+e.message;}
}
onMounted(draw);watch([()=>props.encoded,isDark],async()=>{await nextTick();draw();});
</script>
<template><div class="mermaid-diagram" aria-label="文档流程图"><p v-if="error" role="alert">{{error}}</p><div v-else-if="svg" v-html="svg"/><p v-else class="diagram-loading">正在加载图表…</p></div></template>
