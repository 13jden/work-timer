/**
 * CSS Modules 类型声明
 * 让 .module.css import 返回正确类型
 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module '*.css' {
  const content: string;
  export default content;
}