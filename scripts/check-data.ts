import { createClient } from "@supabase/supabase-js";

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://gashcjenhwamgxrrmbsa.supabase.co";
const supabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_n1syzIIBeS53RL9KWwhtJQ_BML0xunY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDataIntegrity() {
  console.log("🔍 Verificando integridade dos dados no Supabase...\n");

  try {
    // Verificar transações
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("count");

    // Verificar despesas
    const { data: expenses, error: expError } = await supabase
      .from("expenses")
      .select("count");

    // Verificar receitas
    const { data: income, error: incError } = await supabase
      .from("income")
      .select("count");

    // Verificar categorias
    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("count");

    // Verificar cartões
    const { data: creditCards, error: ccError } = await supabase
      .from("credit_cards")
      .select("count");

    console.log("📊 Status dos dados:");
    console.log(
      `  Transações: ${transactions?.length || 0} registros ${txError ? "❌ ERRO" : "✅"}`
    );
    console.log(
      `  Despesas: ${expenses?.length || 0} registros ${expError ? "❌ ERRO" : "✅"}`
    );
    console.log(
      `  Receitas: ${income?.length || 0} registros ${incError ? "❌ ERRO" : "✅"}`
    );
    console.log(
      `  Categorias: ${categories?.length || 0} registros ${catError ? "❌ ERRO" : "✅"}`
    );
    console.log(
      `  Cartões: ${creditCards?.length || 0} registros ${ccError ? "❌ ERRO" : "✅"}`
    );

    if (txError || expError || incError || catError || ccError) {
      console.log("\n⚠️  Alguns dados não puderam ser acessados!");
      console.log("Erros encontrados:");
      if (txError) console.log(`  - Transações: ${txError.message}`);
      if (expError) console.log(`  - Despesas: ${expError.message}`);
      if (incError) console.log(`  - Receitas: ${incError.message}`);
      if (catError) console.log(`  - Categorias: ${catError.message}`);
      if (ccError) console.log(`  - Cartões: ${ccError.message}`);
    } else {
      console.log("\n✅ Todos os dados parecem estar intactos!");
    }
  } catch (error) {
    console.error("❌ Erro ao acessar Supabase:", error);
  }
}

// Executar verificação
checkDataIntegrity();
