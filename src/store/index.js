import Vue from 'vue';
import Vuex from 'vuex';
import firebase from 'firebase';
Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    loginUser: {
      id: null,
      displayName: null,
      wallet: null,
    },
    users: [],
  },
  getters: {
    loginUser: (state) => state.loginUser ? state.loginUser : null,
    users: (state) => state.users,
  },
  mutations: {
    setLoginUser(state, data) {
      state.loginUser = { ...state.loginUser, ...data}
    },
    deleteLoginUser(state) {
      state.loginUser.id = null;
      state.loginUser.displayName = null;
      state.loginUser.wallet = null;
    },
    addUser(state, { id, user }) {
      user.id = id;
      state.users.push(user);
    },
    setWallet(state, data) {
      state.users.forEach((user) => {
        if (user.id === data.targetUserId) {
          user.wallet = data.targetUserWallet;
        }
        if (user.id === data.loginUserId) {
          user.wallet = data.loginUserWallet;
        }
      });
    },
  },
  actions: {
    fetchUsers({ commit }) {
      firebase
        .firestore()
        .collection('users')
        .get()
        .then((snapshot) => {
          snapshot.forEach((doc) =>
            commit('addUser', {
              id: doc.id,
              user: doc.data(),
            })
          );
        });
    },
    register({ dispatch }, authData) {
      firebase
        .auth()
        .createUserWithEmailAndPassword(authData.email, authData.password)
        .then((user) => {
          // walletの初期値（500円）と表示名をusersコレクションに登録
          firebase
            .firestore()
            .collection('users')
            .doc(user.user.uid)
            .set({
              displayName: authData.displayName,
              wallet: 500,
            });
          dispatch('setLoginUser');
        })
        .catch((error) => {
          alert(error.message);
        });
    },
    login({ dispatch }, authData) {
      firebase
        .auth()
        .signInWithEmailAndPassword(authData.email, authData.password)
        .then(() => {
          dispatch('setLoginUser');
        })
        .catch((error) => {
          alert(error.message);
        });
    },
    setLoginUser({ commit }) {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          firebase
            .firestore()
            .collection('users')
            .doc(user.uid)
            .get()
            .then((doc) => {
              commit('setLoginUser', {
                id: user.uid,
                displayName: doc.data().displayName,
                wallet: doc.data().wallet,
              });
            });
        }
      });
    },
    logout() {
      firebase.auth().signOut();
    },
    deleteLoginUser({ commit }) {
      commit('deleteLoginUser');
    },
    sendMoney({ commit }, { loginUserWallet, targetUserId, targetUserWallet }) {
      firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
          return false
        }
        const loginUserRef = firebase
          .firestore()
          .collection('users')
          .doc(user.uid);
        const targetUserRef = firebase
          .firestore()
          .collection('users')
          .doc(targetUserId);

        // トランザクション開始
        firebase
          .firestore()
          .runTransaction(async (transaction) => {
            await Promise.all([
              transaction.get(loginUserRef),
              transaction.get(targetUserRef),
            ]);
            await Promise.all([
              transaction.update(loginUserRef, {
                wallet: loginUserWallet,
              }),
              transaction.update(targetUserRef, {
                wallet: targetUserWallet,
              }),
            ]);
          }) // トランザクション完了
          .then(() => {
            commit('setWallet', {
              loginUserId: user.uid,
              loginUserWallet,
              targetUserId,
              targetUserWallet,
            });
            commit('setLoginUser', { wallet: loginUserWallet });
          });
      })
    },
  },
});