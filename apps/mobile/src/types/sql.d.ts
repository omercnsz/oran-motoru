// Drizzle göç dosyaları (babel-plugin-inline-import ile metin olarak gelir)
declare module '*.sql' {
  const sql: string;
  export default sql;
}
