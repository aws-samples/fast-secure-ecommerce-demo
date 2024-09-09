import Cookies from 'js-cookie';  // TODO replace with https://nextjs.org/docs/app/api-reference/functions/cookies 

// Auth actions
export function logout() {
    if (typeof window !== 'undefined') {
        Cookies.remove("token");
        deleteCartItems();
    }
    return;
}

export function login(token) {
    if (typeof window !== 'undefined') {
        Cookies.set('token', token);
    }
    return;
}

// Cart actions
export function deleteCartItems() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('cartItems');
    }
    return;
}

export function addCartItem(product) {
    if (typeof window !== 'undefined') {
      var cartItems = getCartItems();
      cartItems.push(product)
      localStorage.setItem('cartItems', JSON.stringify(cartItems));
    }
    return;
}

export function getCartItems() {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('cartItems')) || [];
    }
    return;
}

export function getCartCount() {
    if (typeof window !== 'undefined') {
      const items = getCartItems();
      return items.length===0? '': `(${items.length})`;
    }
    return '';
  }
  
  