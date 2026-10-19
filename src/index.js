import guidance from './host-guidance.cjs';
/** Only static guidance; no filesystem, network or conversation mutation. */
export const name = 'reply-beautify';
export const inject = ['tools','systemPrompt'];
export function apply(ctx) {
  // ToolRuntime accepts registry-ready ToolDefinitions using standard JSON Schema.
  // Validate the tiny input explicitly; no dependency on a second runtime copy.
  ctx.tools.register({
    name:'reply_ui_guide',
    description:'Read a reply component specification for charts, tables, calculators, planning, trees, playback, diffs, sources, shared-data reports or isolated HTML mini apps/artifacts. Returns documentation only; then emit fenced JSON in the final reply.',
    parameters:{type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:Object.keys(guidance.GUIDES),description:'Choose a documented component kind: '+Object.keys(guidance.GUIDES).join(', ')}},required:['kind']},
    output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
    isConcurrencySafe:()=>true,
    async execute(args){if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>k!=='kind')||!Object.hasOwn(guidance.GUIDES,args.kind))throw Error('kind must be one of: '+Object.keys(guidance.GUIDES).join(', '));return guidance.GUIDES[args.kind];}
  });
  ctx.systemPrompt.section({name:'reply-beautify:rich-replies',order:10300,interpolate:false,text:guidance.PROMPT});
}
