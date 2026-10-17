import assert from "node:assert/strict";
import test from "node:test";
import { localeFromAcceptLanguage, resolveLocale, setLocale, t, tn, ptBR } from "../src/index.ts";

test("falls back to the English source string", () => {
  setLocale("en-US");
  assert.equal(t("Cancel"), "Cancel");
  assert.equal(t("Untranslated {x}", { x: 1 }), "Untranslated 1");
});

test("translates and interpolates in pt-BR", () => {
  setLocale("pt-PT");
  assert.equal(t("Cancel"), "Cancelar");
  assert.equal(tn(1, "{count} pending bill", "{count} pending bills"), "1 pendente");
  assert.equal(tn(3, "{count} pending bill", "{count} pending bills"), "3 pendentes");
  setLocale("en");
});

test("resolves locale tags and Accept-Language", () => {
  assert.equal(resolveLocale("pt"), "pt-BR");
  assert.equal(resolveLocale("fr-FR"), "en");
  assert.equal(resolveLocale(undefined), "en");
  assert.equal(localeFromAcceptLanguage("pt-BR,pt;q=0.9,en;q=0.8"), "pt-BR");
  assert.equal(localeFromAcceptLanguage("en-GB,en;q=0.9"), "en");
});

test("every pt-BR entry keeps the placeholders of its source", () => {
  for (const [source, translated] of Object.entries(ptBR)) {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    assert.equal(names(translated), names(source), source);
  }
});

test("context prefixes disambiguate without showing up in English", () => {
  setLocale("en");
  assert.equal(t("status::Open"), "Open");
  setLocale("pt-BR");
  assert.equal(t("status::Open"), "Aberto");
  assert.equal(t("Open"), "Abrir");
  setLocale("en");
});
