/*!
      Project:  shorts-player-kit
      File:     js/utils/text.js
      Role:     Provides pure utility functions for text manipulation.
    */
    
    export function stripMarkdownLight(s){ return String(s||'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/__(.+?)__/g,'$1').replace(/\*(.+?)\*/g,'$1').replace(/_(.+?)_/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1').replace(/\[([^\]]+)\]/g,'$1'); }
    
    export function getSpeechFixes(){ try{ const o=window.speechFixes; return (o && typeof o==='object')? o : {}; }catch(_){ return {}; } }
    
    export function scrub(text){ let s=String(text||''); s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,''); s = s.replace(/[:：]/g,'').trim(); return s; }
    
    export function splitChunksJa(s, maxLen=90){
      // 句読点を優先に細切れ化。iOS の onend 欠落に強い短尺化
      const t=scrub(s); if(!t) return [];
      const seps='。．！？?!\n、・：；'; // 追加の弱セパレータも採用
      const raw=[]; let buf='';
      for(let i=0;i<t.length;i++){
        const ch=t[i]; buf+=ch;
        if(seps.indexOf(ch)!==-1){
          // 後続の空白は巻き取る
          while(i+1<t.length && /\s/.test(t[i+1])){ buf+=t[++i]; }
          if(buf.trim()){ raw.push(buf.trim()); buf=''; }
        }
      }
      if(buf.trim()) raw.push(buf.trim());
      // 上限で無理切りする時は可能なら空白・読点付近にスナップ
      const out=[];
      for(let seg of raw){
        while(seg.length>maxLen){
          let cut=maxLen, snap=-1;
          for(let k=maxLen;k>=Math.max(40,maxLen-20);k--){
            if(' 、・：；。．!?？！”）)]'.indexOf(seg[k])!==-1){ snap=k+1; break; }
          }
          if(snap>0) cut=snap;
          out.push(seg.slice(0,cut).trim());
          seg=seg.slice(cut);
        }
        if(seg) out.push(seg);
      }
      return out;
    }