"use client";

import { CartLine } from "@/types";

// Client-only cart, persisted in localStorage. This is a real deployed
// Next.js app running in an actual browser, so localStorage is the right
// tool here — no server-side cart table needed at this volume. An order is
// only written to the database once the customer checks out.
const CART_KEY = "quickcart_cart_v1";

export function getCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function saveCart(cart: CartLine[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function addToCart(line: Omit<CartLine, "quantity">, quantity = 1): CartLine[] {
  const cart = getCart();
  const existing = cart.find((c) => c.productId === line.productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ ...line, quantity });
  }
  saveCart(cart);
  return cart;
}

export function updateQuantity(productId: string, quantity: number): CartLine[] {
  let cart = getCart();
  if (quantity <= 0) {
    cart = cart.filter((c) => c.productId !== productId);
  } else {
    const existing = cart.find((c) => c.productId === productId);
    if (existing) existing.quantity = quantity;
  }
  saveCart(cart);
  return cart;
}

export function clearCart() {
  saveCart([]);
}
